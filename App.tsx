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
import { OnboardingTour } from './components/OnboardingTour';
import { OnboardingChecklist } from './components/OnboardingChecklist';
import { ProfilePhotoModal } from './components/ProfilePhotoModal';

import { NotificationsModal } from './components/NotificationsModal';
import { NotificationBell } from './components/NotificationBell';
import { AdminView } from './components/AdminView';
import { CompleteProfileView } from './components/CompleteProfileView';
import { ResetPasswordView } from './components/ResetPasswordView';
import { UpdateChecker } from './components/UpdateChecker';
import { EditTransactionModal } from './components/EditTransactionModal';
import { App as CapacitorApp } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { OfflineService } from './OfflineService';
import { formatInTimeZone, toDate } from 'date-fns-tz';

import { useDashboardModals } from './hooks/useDashboardModals';
import { usePushNotifications } from './hooks/usePushNotifications';
import { usePasswordRecovery } from './hooks/usePasswordRecovery';
import { trackEvent } from './utils/analytics';

const SANTIAGO_TZ = 'America/Santiago';

const App: React.FC = () => {
  const { user, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>(Tab.Home);

  // Modular Custom Hooks
  const {
    isFabOpen,
    setIsFabOpen,
    showScan,
    setShowScan,
    showTip,
    setShowTip,
    showNewService,
    setShowNewService,
    showSupplyExpense,
    setShowSupplyExpense,
    showNotifications,
    setShowNotifications,
    showProfilePhoto,
    setShowProfilePhoto,
    editingTransaction,
    setEditingTransaction,
  } = useDashboardModals();

  const { isPasswordReset, setIsPasswordReset, isCheckingRecovery } = usePasswordRecovery();
  const { fcmToken, requestPushPermissions } = usePushNotifications(user, () => setShowNotifications(true));

  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [totalIncome, setTotalIncome] = useState(0); // This will be Net (Total Real)
  const [totalGrossIncome, setTotalGrossIncome] = useState(0); // This will be Gross (Balance Estimado)
  const [totalSupplyExpense, setTotalSupplyExpense] = useState(0);
  const [averageTicket, setAverageTicket] = useState(0);
  const [savingsGoal, setSavingsGoal] = useState<{ current: number, target: number, name: string } | null>(null);

  // Telemetry: App Install Opened (ANA-01)
  React.useEffect(() => {
    trackEvent('app_install_opened', {
      app_version: '1.2.0'
    });
  }, []);

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

  // Sync Offline Data on Mount
  React.useEffect(() => {
    if (user) {
      OfflineService.syncPending(user.id);
      
      // Optional: Setup a focal point for recurring sync
      const interval = setInterval(() => {
        OfflineService.syncPending(user.id);
      }, 30000); // 30 seconds

      return () => clearInterval(interval);
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
        rawDate: t.date,
        gross_amount: t.gross_amount // Adding this back simply!
      }));
 
      // 1.5 Fuse with local pending transactions
      const fused = await OfflineService.getFusedTransactions(user.id, transactions);

      setRecentTransactions(fused.slice(0, 5)); // Show only last 5 in list

      // Track first_transaction_logged (ANA-01)
      if (fused.length === 1 && localStorage.getItem('has_logged_first_tx') !== 'true') {
        localStorage.setItem('has_logged_first_tx', 'true');
        trackEvent('first_transaction_logged', {
          method: fused[0].category === 'service' ? 'service' : 'expense',
          category: fused[0].category
        });
      }

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

      // Use fused transactions for ALL calculations below
      const fusedFull = fused;

      // Recalculate Income based on Weekly Model
      // Use Santiago time for comparison to avoid UTC month-boundary bugs
      const todayISO = formatInTimeZone(new Date(), SANTIAGO_TZ, 'yyyy-MM-dd');
      
      // Get Start of week based on Santiago Time
      const nowAtSantiago = toDate(new Date(), { timeZone: SANTIAGO_TZ });
      const dayOfWeek = nowAtSantiago.getDay(); // 0-6
      const diffDay = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust Monday as start
      
      const startOfWeek = new Date(nowAtSantiago);
      startOfWeek.setDate(nowAtSantiago.getDate() + diffDay);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const weeklyTransactions = fusedFull.filter((t: any) => {
        // Parse rawDate into Santiago time
        const txDateStr = formatInTimeZone(new Date(t.rawDate), SANTIAGO_TZ, 'yyyy-MM-dd HH:mm:ss');
        const txDate = toDate(txDateStr, { timeZone: SANTIAGO_TZ });
        return txDate >= startOfWeek && txDate <= endOfWeek;
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
      // Calculate Monthly Gross for KPI using Santiago stable months
      const monthlyTransactions = fusedFull.filter((t: any) => {
        const txMonthStr = formatInTimeZone(new Date(t.rawDate), SANTIAGO_TZ, 'yyyy-MM');
        const currentMonthStr = formatInTimeZone(new Date(), SANTIAGO_TZ, 'yyyy-MM');
        return txMonthStr === currentMonthStr;
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
      <OnboardingTour />
      <UpdateChecker />
      <AnnouncementListener />
      <div className="min-h-screen bg-background-light font-display pt-[calc(env(safe-area-inset-top)+1rem)]">
        {/* Top Gradient Blob */}
        <div className="fixed top-0 left-0 right-0 h-[500px] w-full -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-primary/15 blur-[120px] rounded-full mix-blend-multiply opacity-60 animate-blob"></div>
          <div className="absolute top-[-20%] right-[-10%] w-[70%] h-[70%] bg-accent/15 blur-[120px] rounded-full mix-blend-multiply opacity-60 animate-blob animation-delay-2000"></div>
          <div className="absolute top-[-40%] left-[20%] w-[70%] h-[70%] bg-indigo-300/15 blur-[120px] rounded-full mix-blend-multiply opacity-60 animate-blob animation-delay-4000"></div>
        </div>

        {/* Centered App Container for Responsive Polish */}
        <div className="w-full max-w-2xl lg:max-w-4xl mx-auto px-4 sm:px-6 transition-all">
          {/* Top App Bar - Only for Home */}
          {activeTab === Tab.Home && (
            <header className="relative z-20 flex items-center justify-between py-4 sm:py-6 bg-transparent transition-colors">
              <div className="flex items-center gap-3">
                <div 
                  className="relative group cursor-pointer transition-transform active:scale-90 hover:scale-105"
                  onClick={() => setShowProfilePhoto(true)}
                >
                  <div
                    className="bg-center bg-no-repeat bg-cover rounded-full size-12 ring-2 ring-white shadow-md border-2 border-slate-100 transition-shadow"
                    style={{ backgroundImage: `url("${user.user_metadata.avatar_url || 'https://ui-avatars.com/api/?name=User&background=random'}")` }}
                  ></div>
                  {/* Status indicator */}
                  <div className="absolute bottom-0 right-0 size-3.5 bg-green-500 rounded-full border-2 border-white"></div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div data-tour="notification-bell">
                  <NotificationBell onClick={() => setShowNotifications(true)} />
                </div>
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

          {/* Profile Photo Modal */}
          <ProfilePhotoModal 
            isOpen={showProfilePhoto} 
            onClose={() => setShowProfilePhoto(false)} 
            currentAvatarUrl={user?.user_metadata?.avatar_url}
            userName={user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || "Usuario"}
          />

          {/* Main Content */}
          <main className="flex flex-col gap-6 pt-2 pb-32">
            <AnimatePresence mode='wait'>
              {activeTab === Tab.Home && (
                <motion.div
                  key="home"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col gap-6"
                >
                  <section className="flex flex-col gap-4" data-tour="balance-card">
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

                  <section data-tour="kpi-grid">
                    <KpiGrid items={kpis} />
                  </section>

                  <OnboardingChecklist 
                    userData={user?.user_metadata} 
                    transactions={recentTransactions} 
                    onAction={(type) => {
                      if (type === 'new-service') setShowNewService(true);
                      if (type === 'advisor') setActiveTab(Tab.Advisor);
                      if (type === 'profile') setActiveTab(Tab.Profile);
                    }}
                  />

                  <section className="mt-2">
                    <h3 className="text-base font-bold text-slate-900 mb-4 px-1">Últimos Ingresos</h3>
                    <TransactionsList transactions={recentTransactions} onEdit={(tx) => setEditingTransaction(tx)} />
                  </section>
                </motion.div>
              )}

              {activeTab === Tab.Income && (
                <IncomeView 
                  onGoToReports={() => setActiveTab(Tab.Reports)} 
                  onOpenNotifications={() => setShowNotifications(true)}
                  onOpenProfilePhoto={() => setShowProfilePhoto(true)}
                />
              )}
              {activeTab === Tab.Advisor && (
                <AdvisorView 
                  onOpenNotifications={() => setShowNotifications(true)} 
                />
              )}
              {activeTab === Tab.Profile && <ProfileView />}

              {activeTab === Tab.Reports && <ReportsView />}
            </AnimatePresence>
          </main>
        </div>

        {/* FAB - Only for Home */}
        {activeTab === Tab.Home && (
          <div
            className="fixed right-5 md:right-8 lg:right-[max(2rem,calc((100vw-56rem)/2+1rem))] z-50 flex flex-col items-end gap-3 pointer-events-none"
            style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
          >
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
              data-tour="fab-button"
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
          {showNewService && <NewServiceModal onClose={() => setShowNewService(false)} onRequestPush={requestPushPermissions} />}
          {showSupplyExpense && <SupplyExpenseModal onClose={() => setShowSupplyExpense(false)} />}
          {showNotifications && <NotificationsModal onClose={() => setShowNotifications(false)} />}
          {editingTransaction && (
            <EditTransactionModal 
              transaction={editingTransaction} 
              onClose={() => setEditingTransaction(null)} 
              onUpdated={() => fetchData()}
              onDeleted={() => fetchData()}
            />
          )}
        </AnimatePresence>

        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </ToastProvider>
  );
};

export default App;