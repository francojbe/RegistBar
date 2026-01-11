import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from './components/Icons';
import { SavingsGoalCard, FiscalSavingsCard, KpiGrid, TransactionsList } from './components/DashboardWidgets';
import { BottomNav } from './components/BottomNav';
import { Transaction, KPI, Tab } from './types';

import { IncomeView } from './components/IncomeView';
import { ProfileView } from './components/ProfileView';
import { AdvisorView } from './components/AdvisorView';
import { ReportsView } from './components/ReportsView';
import { ScanReceiptView } from './components/ScanReceiptView';
import { LoginView } from './components/LoginView';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './supabaseClient';
import { ToastProvider } from './contexts/ToastContext';
import { AnnouncementListener } from './components/AnnouncementListener';
import { TipModal } from './components/TipModal';
import { NewServiceModal } from './components/NewServiceModal';
import { SupplyExpenseModal } from './components/SupplyExpenseModal';

import { NotificationsModal } from './components/NotificationsModal';
import { NotificationBell } from './components/NotificationBell';
import { AdminView } from './components/AdminView';
import { CompleteProfileView } from './components/CompleteProfileView';
import { ResetPasswordView } from './components/ResetPasswordView';
import { App as CapacitorApp } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

const App: React.FC = () => {
  const { user, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>(Tab.Home);
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [showNewService, setShowNewService] = useState(false);
  const [showSupplyExpense, setShowSupplyExpense] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isPasswordReset, setIsPasswordReset] = useState(() => {
    // Persist recovery state across re-renders
    return sessionStorage.getItem('recovery_mode') === 'true';
  });
  const [isCheckingRecovery, setIsCheckingRecovery] = useState(true); // New Blocker State
  const [fcmToken, setFcmToken] = useState<string | null>(null);



  // Push Notifications Setup
  React.useEffect(() => {
    if (Capacitor.getPlatform() === 'web') return;

    const registerPush = async () => {
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.log('User denied permissions!');
        return;
      }

      await PushNotifications.register();
    };

    registerPush();

    // Listeners
    PushNotifications.addListener('registration', token => {
      console.log('My token: ' + token.value);
      setFcmToken(token.value);
    });

    PushNotifications.addListener('registrationError', (error: any) => {
      console.log('Error on registration: ' + JSON.stringify(error));
    });

    PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
      console.log('Push received: ' + JSON.stringify(notification));
      const { title, body } = notification;
      alert(`🔔 Notificación recibida:\n${title}\n${body}`);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification: any) => {
      console.log('Push action performed: ' + JSON.stringify(notification));
      setShowNotifications(true);
    });

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, []);

  // Sync Token with Supabase (Multi-device support)
  React.useEffect(() => {
    const saveToken = async () => {
      if (user && fcmToken) {
        // Upsert into user_devices: if token exists, update timestamp; if not, insert.
        const { error } = await supabase
          .from('user_devices')
          .upsert({
            user_id: user.id,
            fcm_token: fcmToken,
            device_type: Capacitor.getPlatform(), // 'android', 'ios', or 'web'
            last_used_at: new Date().toISOString()
          }, { onConflict: 'fcm_token' });

        if (error) {
          console.error('Error saving device token:', error);
        } else {
          console.log('Device token synced successfully!');
        }
      }
    };
    saveToken();
  }, [user, fcmToken]);

  // Handle Password Recovery & Deep Links
  React.useEffect(() => {
    // 0. Check Web Hash on Mount (For Browser Support)
    if (window.location.hash && window.location.hash.includes('type=recovery')) {
      console.log("Recovery hash detected!");
      sessionStorage.setItem('recovery_mode', 'true');
      setIsPasswordReset(true);
    }
    // Release the blocker immediately after checking the URL
    setIsCheckingRecovery(false);

    // 1. Listen for Supabase Auth Events (Magic Link / Recovery)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth Event:", event);
      if (event === 'PASSWORD_RECOVERY') {
        console.log("Password Recovery Event Triggered!");
        sessionStorage.setItem('recovery_mode', 'true');
        setIsPasswordReset(true);
      }
    });

    // 2. Listen for Deep Links (Android)
    const setupDeepLinks = async () => {
      await CapacitorApp.removeAllListeners();

      CapacitorApp.addListener('appUrlOpen', async (data) => {
        try {
          const urlStr = data.url;
          // Check for 'reset-password' path OR 'type=recovery' param
          if (urlStr.includes('reset-password') || urlStr.includes('type=recovery')) {
            const url = new URL(urlStr);
            const hash = url.hash.substring(1);
            const params = new URLSearchParams(hash);
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');

            if (accessToken && refreshToken) {
              const { error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
              });
              if (!error) {
                sessionStorage.setItem('recovery_mode', 'true');
                setIsPasswordReset(true);
              }
            }
          }
          // Check for completion action (e.g. Password Updated externally)
          else if (urlStr.includes('action_complete')) {
            console.log("Action complete deep link detected. Signing out stale session.");
            await supabase.auth.signOut();
            window.location.reload(); // Reload to force clean state (Login View)
          }
        } catch (e) {
          console.error('Error handling deep link:', e);
        }
      });
    };

    setupDeepLinks();

    return () => {
      subscription.unsubscribe();
      CapacitorApp.removeAllListeners();
    };
  }, []);

  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [totalIncome, setTotalIncome] = useState(0); // This will be Net (Total Real)
  const [totalGrossIncome, setTotalGrossIncome] = useState(0); // This will be Gross (Balance Estimado)
  const [totalSupplyExpense, setTotalSupplyExpense] = useState(0);
  const [averageTicket, setAverageTicket] = useState(0);
  const [savingsGoal, setSavingsGoal] = useState<{ current: number, target: number, name: string } | null>(null);

  // Initialize Theme
  React.useEffect(() => {
    const applyTheme = (theme: string | null) => {
      document.body.classList.remove('theme-ocean', 'theme-pink');
      if (theme === 'ocean') {
        document.body.classList.add('theme-ocean');
      } else if (theme === 'pink') {
        document.body.classList.add('theme-pink');
      }
      // 'default' implies base Violet theme (no class added)
    };

    const savedTheme = localStorage.getItem('theme');
    const userTheme = user?.user_metadata?.theme;
    const userGender = user?.user_metadata?.gender;

    let finalTheme = 'default';

    // 1. Priority: LocalStorage (Active Session) - Highest priority for immediate feedback
    if (savedTheme) {
      finalTheme = savedTheme;
    }
    // 2. Priority: User Metadata (Cloud Preference) - Honors explicit 'default', 'pink', 'ocean'
    else if (userTheme) {
      finalTheme = userTheme;
    }
    // 3. Priority: Gender (Fallback) - Only used if NO theme is set in metadata
    else if (userGender) {
      if (userGender === 'male') finalTheme = 'ocean';
      else if (userGender === 'female') finalTheme = 'pink';
    }

    applyTheme(finalTheme);

    // Sync local storage if we determined a theme and it isn't what's currently saved
    if (savedTheme !== finalTheme) {
      localStorage.setItem('theme', finalTheme);
    }
  }, [user]);

  // Fetch Data function to be reused
  const fetchData = async () => {
    if (!user || isPasswordReset) return;

    // 1. Fetch Transactions
    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (txError) {
      console.error('Error fetching transactions:', txError);
    } else {
      // Process Transactions
      const transactions: Transaction[] = (txData || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        date: new Date(t.date).toLocaleDateString('es-CL', { timeZone: 'America/Santiago' }),
        time: new Date(t.date).toLocaleTimeString('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit' }),
        amount: t.amount,
        type: t.type,
        category: t.category,
        icon: t.category === 'service' ? 'content_cut' : t.category === 'tip' ? 'savings' : 'shopping_bag',
        rawDate: t.date
      }));

      setRecentTransactions(transactions.slice(0, 5)); // Show only last 5 in list

      // 2. Fetch Goals
      const { data: goalData, error: goalError } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (!goalError && goalData) {
        setSavingsGoal({
          current: goalData.current_amount || 0,
          target: goalData.target_amount || 1000000,
          name: goalData.name || 'Mi Meta'
        });
      } else {
        setSavingsGoal(null);
      }

      // 3. Fetch Profile for Expense Model
      const { data: profileData } = await supabase
        .from('profiles')
        .select('expense_model, rent_amount, rent_period')
        .eq('id', user.id)
        .single();

      // Recalculate Income based on Weekly Model
      const now = new Date();

      // Get Start of Week (Monday)
      const day = now.getDay(); // 0 (Sun) to 6 (Sat)
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      const startOfWeek = new Date(now.setDate(diff));
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const weeklyTransactions = (txData || []).filter((t: any) => {
        const d = new Date(t.date);
        return d >= startOfWeek && d <= endOfWeek;
      });

      const weeklyGross = weeklyTransactions
        .filter((t: any) => t.type === 'income')
        .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);

      // Calculate Weekly Expenses (Supplies)
      const weeklySupplies = weeklyTransactions
        .filter((t: any) => t.category === 'supply')
        .reduce((sum: number, t: any) => sum + (Math.abs(Number(t.amount)) || 0), 0);

      // Calculate Weekly Savings (Manual Contributions)
      const weeklySavings = weeklyTransactions
        .filter((t: any) => t.title && t.title.includes('Aporte a Ahorro'))
        .reduce((sum: number, t: any) => sum + (Math.abs(Number(t.amount)) || 0), 0);

      // 1. Calculate Production Net is NOT used for the small number anymore.
      // Small number ("Ventas Totales") = weeklyGross

      // 2. Calculate Final Balance (Gross - Rent - Supplies - Savings)
      let finalBalance = weeklyGross;

      // Deduct Rent
      if (profileData?.expense_model === 'rent') {
        const rent = Number(profileData.rent_amount) || 0;
        const period = profileData.rent_period || 'monthly';
        const deduction = period === 'weekly' ? rent : Math.round(rent / 4);
        finalBalance -= deduction;
      }

      // Deduct Supplies and Savings
      finalBalance -= weeklySupplies;
      finalBalance -= weeklySavings;

      setTotalGrossIncome(weeklyGross); // Storing Clean Gross Sales here
      setTotalIncome(finalBalance);     // Storing Final Net Balance here

      setTotalSupplyExpense(weeklySupplies);

      // Average Ticket (Weekly) -> Now repurposed as Monthly Balance
      // Calculate Monthly Gross for KPI
      const monthlyTransactions = (txData || []).filter((t: any) => {
        const d = new Date(t.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });

      const monthlyGross = monthlyTransactions
        .filter((t: any) => t.type === 'income')
        .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);

      const monthlySupplies = monthlyTransactions
        .filter((t: any) => t.category === 'supply')
        .reduce((sum: number, t: any) => sum + (Math.abs(Number(t.amount)) || 0), 0);

      const monthlySavings = monthlyTransactions
        .filter((t: any) => t.title && t.title.includes('Aporte a Ahorro'))
        .reduce((sum: number, t: any) => sum + (Math.abs(Number(t.amount)) || 0), 0);

      let monthlyNet = monthlyGross - monthlySupplies - monthlySavings;

      // Deduct Rent (Monthly)
      if (profileData?.expense_model === 'rent') {
        monthlyNet -= (Number(profileData.rent_amount) || 0);
      }

      setAverageTicket(monthlyNet); // Stores Monthly Net Balance
    }
  };

  // Fetch Data on Mount and Tab Change
  React.useEffect(() => {
    fetchData();
  }, [user, activeTab]);

  // Initialize Theme
  React.useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'ocean') {
      document.body.classList.add('theme-ocean');
    }
  }, []);

  // Dynamic KPIs (Updated Labels)
  const kpis: KPI[] = [
    {
      label: 'Balance Mensual',
      value: `$ ${averageTicket.toLocaleString('es-CL')}`,
      trend: 0,
      icon: 'calendar_month', // Changed icon to represent month
      iconBgClass: 'bg-purple-100',
      iconColorClass: 'text-purple-600',
      chartData: []
    },
    {
      label: 'Gasto Insumos (Sem)',
      value: `$ ${totalSupplyExpense.toLocaleString('es-CL')}`,
      trend: 0,
      icon: 'shopping_bag',
      iconBgClass: 'bg-orange-100',
      iconColorClass: 'text-orange-600',
      chartData: []
    }
  ];

  if (loading || isCheckingRecovery) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-dark text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isPasswordReset) {
    return (
      <ToastProvider>
        <ResetPasswordView />
      </ToastProvider>
    );
  }

  if (!user) {
    return (
      <ToastProvider>
        <LoginView />
      </ToastProvider>
    );
  }

  // Intercept users without gender/theme setup (e.g. Google Login)
  if (!user.user_metadata?.gender) {
    return (
      <ToastProvider>
        <CompleteProfileView />
      </ToastProvider>
    );
  }

  if (user.email === 'franco.blanco@efinnovation.cl') {
    return (
      <ToastProvider>
        <div className="min-h-screen bg-background-dark">
          <AdminView onClose={() => { }} />
        </div>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <AnnouncementListener />
      <div className="min-h-screen bg-background-light font-display">
        {/* Top Gradient Blob */}
        <div className="fixed top-0 left-0 right-0 h-[500px] w-full -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-primary/20 blur-[100px] rounded-full mix-blend-multiply opacity-70 animate-blob"></div>
          <div className="absolute top-[-20%] right-[-10%] w-[70%] h-[70%] bg-accent/20 blur-[100px] rounded-full mix-blend-multiply opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute top-[-40%] left-[20%] w-[70%] h-[70%] bg-pink-300/20 blur-[100px] rounded-full mix-blend-multiply opacity-70 animate-blob animation-delay-4000"></div>
        </div>

        {/* Top App Bar - Only for Home */}
        {activeTab === Tab.Home && (
          <header className="relative z-20 flex items-center justify-between px-6 py-6 bg-transparent transition-colors">
            <div className="flex items-center gap-3">
              <div className="relative group cursor-pointer transition-transform active:scale-95">
                <div
                  className="bg-center bg-no-repeat bg-cover rounded-full size-12 ring-2 ring-white shadow-sm"
                  style={{ backgroundImage: `url("${user.user_metadata.avatar_url || 'https://ui-avatars.com/api/?name=User&background=random'}")` }}
                ></div>
                {/* Status indicator */}
                <div className="absolute bottom-0 right-0 size-3.5 bg-green-500 rounded-full border-2 border-white"></div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell onClick={() => setShowNotifications(true)} />
              <button
                onClick={signOut}
                className="flex items-center justify-center size-12 rounded-full bg-white shadow-soft hover:shadow-lg transition-all active:scale-95 text-red-500"
                title="Cerrar Sesión"
              >
                <Icon name="logout" size={22} />
              </button>
            </div>
          </header>
        )}

        {/* Global Floating Notification Bell (Visible on non-home tabs) */}
        {activeTab !== Tab.Home && (
          <div className="absolute top-6 right-20 z-40 flex gap-3 pointer-events-none">
            <div className="pointer-events-auto">
              <NotificationBell onClick={() => setShowNotifications(true)} />
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex flex-col gap-6 px-4 pt-2 pb-32">
          <AnimatePresence mode='wait'>
            {activeTab === Tab.Home && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col gap-6"
              >
                <section className="flex flex-col gap-4">
                  <FiscalSavingsCard grossIncome={totalIncome} netIncome={totalGrossIncome} />
                </section>

                {savingsGoal && (
                  <section className="flex flex-col gap-3">
                    <SavingsGoalCard
                      currentSaved={savingsGoal.current}
                      savingsGoal={savingsGoal.target}
                      savingsGoalName={savingsGoal.name}
                      onGoalUpdated={fetchData}
                    />
                  </section>
                )}

                <section>
                  <KpiGrid items={kpis} />
                </section>

                <section className="mt-2">
                  <h3 className="text-base font-bold text-slate-900 mb-4 px-1">Últimos Ingresos</h3>
                  <TransactionsList transactions={recentTransactions} />
                </section>
              </motion.div>
            )}

            {activeTab === Tab.Income && <IncomeView onGoToReports={() => setActiveTab(Tab.Reports)} />}
            {activeTab === Tab.Advisor && <AdvisorView />}
            {activeTab === Tab.Profile && <ProfileView />}

            {activeTab === Tab.Reports && <ReportsView />}
          </AnimatePresence>
        </main>

        {/* FAB - Only for Home */}
        {activeTab === Tab.Home && (
          <div className="fixed bottom-24 right-5 z-40 flex flex-col items-end gap-3 pointer-events-none">
            {/* FAB Menu Options */}
            <div className={`flex flex-col gap-3 transition-all duration-300 origin-bottom-right relative z-50 pointer-events-auto ${isFabOpen ? 'opacity-100 scale-100 translate-y-0 visible' : 'opacity-0 scale-75 translate-y-10 invisible'}`}>

              {/* Option 5: Register Service */}
              <button
                onClick={() => {
                  setShowNewService(true);
                  setIsFabOpen(false);
                }}
                className="group flex items-center justify-end gap-3 text-right"
              >
                <span className="bg-white px-3 py-1.5 rounded-lg shadow-sm text-sm font-bold text-slate-700">
                  Registrar Servicio
                </span>
                <div className="flex items-center justify-center size-12 rounded-full bg-blue-500 text-white shadow-lg hover:scale-105 active:scale-95 transition-all">
                  <Icon name="content_cut" size={20} />
                </div>
              </button>

              {/* Option 4: Register Supply Expense */}
              <button
                onClick={() => {
                  setShowSupplyExpense(true);
                  setIsFabOpen(false);
                }}
                className="group flex items-center justify-end gap-3 text-right"
              >
                <span className="bg-white px-3 py-1.5 rounded-lg shadow-sm text-sm font-bold text-slate-700">
                  Registrar Gasto Insumo
                </span>
                <div className="flex items-center justify-center size-12 rounded-full bg-orange-500 text-white shadow-lg hover:scale-105 active:scale-95 transition-all">
                  <Icon name="shopping_bag" size={20} />
                </div>
              </button>

              {/* Option 2: Scan with Camera (Consolidated Option) */}
              <button
                onClick={() => {
                  setShowScan(true);
                  setIsFabOpen(false);
                }}
                className="group flex items-center justify-end gap-3 text-right"
              >
                <span className="bg-white px-3 py-1.5 rounded-lg shadow-sm text-sm font-bold text-slate-700">
                  Escanear con Cámara
                </span>
                <div className="flex items-center justify-center size-12 rounded-full bg-emerald-500 text-white shadow-lg hover:scale-105 active:scale-95 transition-all">
                  <Icon name="photo_camera" size={20} />
                </div>
              </button>

              {/* Option 1: Quick Tip */}
              <button
                onClick={() => {
                  setShowTip(true);
                  setIsFabOpen(false);
                }}
                className="group flex items-center justify-end gap-3 text-right"
              >
                <span className="bg-white px-3 py-1.5 rounded-lg shadow-sm text-sm font-bold text-slate-700">
                  Propina Rápida
                </span>
                <div className="flex items-center justify-center size-12 rounded-full bg-green-500 text-white shadow-lg hover:scale-105 active:scale-95 transition-all">
                  <Icon name="savings" size={20} />
                </div>
              </button>
            </div>

            {/* Main FAB Toggle */}
            <button
              onClick={() => setIsFabOpen(!isFabOpen)}
              className={`group flex items-center justify-center size-14 rounded-full shadow-neon hover:scale-105 transition-all duration-300 active:scale-95 z-50 pointer-events-auto ${isFabOpen ? 'bg-slate-800 text-white rotate-45' : 'bg-primary text-background-dark'}`}
            >
              <Icon name="add" size={32} className="transition-transform duration-300 py-1" />
            </button>

            {/* Backdrop for closing */}
            {isFabOpen && (
              <div
                className="fixed inset-0 bg-black/60 z-30 backdrop-blur-[2px] transition-opacity duration-300"
                onClick={() => setIsFabOpen(false)}
              ></div>
            )}
          </div>
        )}

        {/* Modals & Overlays */}
        <AnimatePresence>
          {showScan && <ScanReceiptView onClose={() => setShowScan(false)} />}
          {showTip && <TipModal onClose={() => setShowTip(false)} />}
          {showNewService && <NewServiceModal onClose={() => setShowNewService(false)} />}
          {showSupplyExpense && <SupplyExpenseModal onClose={() => setShowSupplyExpense(false)} />}
          {showNotifications && <NotificationsModal onClose={() => setShowNotifications(false)} />}
        </AnimatePresence>

        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </ToastProvider>
  );
};

export default App;