import React, { useState } from 'react';
import { Icon } from './Icons';
import { Transaction, KPI } from '../types';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';

import { useCurrency } from '../utils/currency';

import { formatInTimeZone, toDate } from 'date-fns-tz';

const SANTIAGO_TZ = 'America/Santiago';

// --- Savings Card (Now Income Accumulator with Period Switcher) ---
interface FiscalSavingsCardProps {
  transactions?: Transaction[];
  profileData?: {
    expense_model?: 'commission' | 'rent';
    rent_amount?: number;
    rent_period?: 'weekly' | 'monthly';
  } | null;
  grossIncome?: number;
  netIncome?: number;
}

export const FiscalSavingsCard: React.FC<FiscalSavingsCardProps> = ({ 
  transactions = [], 
  profileData,
  grossIncome: fallbackGross = 0,
  netIncome: fallbackNet = 0 
}) => {
  const { format } = useCurrency();
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');

  const stats = React.useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return {
        title: period === 'weekly' ? 'Ganancia Neta (Semana)' : period === 'monthly' ? 'Ganancia Neta (Mes)' : 'Ganancia Neta (Año)',
        subtitle: 'Semana en curso',
        net: fallbackGross,
        gross: fallbackNet,
        expenses: Math.max(0, fallbackNet - fallbackGross),
        servicesCount: 0
      };
    }

    const nowAtSantiago = toDate(new Date(), { timeZone: SANTIAGO_TZ });
    const currentYear = nowAtSantiago.getFullYear();
    const currentMonthStr = formatInTimeZone(nowAtSantiago, SANTIAGO_TZ, 'yyyy-MM');

    // 1. Weekly boundary (Monday to Sunday)
    const dayOfWeek = nowAtSantiago.getDay();
    const diffDay = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfWeek = new Date(nowAtSantiago);
    startOfWeek.setDate(nowAtSantiago.getDate() + diffDay);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    let filtered: Transaction[] = [];
    let periodTitle = 'Ganancia Neta (Semana)';
    let periodSubtitle = `${formatInTimeZone(startOfWeek, SANTIAGO_TZ, 'dd MMM')} - ${formatInTimeZone(endOfWeek, SANTIAGO_TZ, 'dd MMM')}`;
    let rentDeduction = 0;

    const rentAmount = Number(profileData?.rent_amount) || 0;
    const isRentModel = profileData?.expense_model === 'rent';
    const rentPeriod = profileData?.rent_period || 'monthly';

    if (period === 'weekly') {
      periodTitle = 'Ganancia Neta (Semana)';
      filtered = transactions.filter(t => {
        const txDate = toDate(formatInTimeZone(new Date(t.rawDate), SANTIAGO_TZ, 'yyyy-MM-dd HH:mm:ss'), { timeZone: SANTIAGO_TZ });
        return txDate >= startOfWeek && txDate <= endOfWeek;
      });

      if (isRentModel && rentAmount > 0) {
        rentDeduction = rentPeriod === 'weekly' ? rentAmount : Math.round(rentAmount / 4);
      }
    } else if (period === 'monthly') {
      periodTitle = 'Ganancia Neta (Mes)';
      const monthName = nowAtSantiago.toLocaleDateString('es-CL', { month: 'long', year: 'numeric', timeZone: SANTIAGO_TZ });
      periodSubtitle = monthName.charAt(0).toUpperCase() + monthName.slice(1);

      filtered = transactions.filter(t => {
        const txMonthStr = formatInTimeZone(new Date(t.rawDate), SANTIAGO_TZ, 'yyyy-MM');
        return txMonthStr === currentMonthStr;
      });

      if (isRentModel && rentAmount > 0) {
        rentDeduction = rentPeriod === 'weekly' ? rentAmount * 4 : rentAmount;
      }
    } else {
      // Yearly
      periodTitle = 'Ganancia Neta (Año)';
      periodSubtitle = `Año ${currentYear}`;

      filtered = transactions.filter(t => {
        const txYear = new Date(t.rawDate).getFullYear();
        return txYear === currentYear;
      });

      if (isRentModel && rentAmount > 0) {
        const monthsPassed = nowAtSantiago.getMonth() + 1;
        const monthlyRent = rentPeriod === 'weekly' ? rentAmount * 4 : rentAmount;
        rentDeduction = monthlyRent * monthsPassed;
      }
    }

    const gross = filtered
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const explicitExpenses = filtered
      .filter(t => t.type === 'expense' || t.category === 'supply' || (t.title && t.title.includes('Aporte a Ahorro')))
      .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

    const totalCosts = explicitExpenses + rentDeduction;
    const net = gross - totalCosts;
    const servicesCount = filtered.filter(t => t.type === 'income' && t.category === 'service').length;

    return {
      title: periodTitle,
      subtitle: periodSubtitle,
      net,
      gross,
      expenses: totalCosts,
      servicesCount
    };
  }, [transactions, profileData, period, fallbackGross, fallbackNet]);

  return (
    <div className="w-full bg-white rounded-[2rem] p-5 shadow-soft relative overflow-hidden group transition-all duration-300 border border-slate-100">
      <div className="relative z-10 flex flex-col gap-3">
        {/* Header: Title + Period Switcher (Single Line) */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-xs sm:text-sm font-black text-slate-400 uppercase tracking-wider truncate">
              Ganancia Neta
            </span>
            <span className="text-xs font-semibold text-primary truncate">
              • {stats.subtitle}
            </span>
          </div>

          {/* Period Selector Tabs */}
          <div className="flex items-center p-0.5 bg-slate-100/90 rounded-xl flex-shrink-0">
            {(['weekly', 'monthly', 'yearly'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                  period === p
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {p === 'weekly' ? 'Sem' : p === 'monthly' ? 'Mes' : 'Año'}
              </button>
            ))}
          </div>
        </div>

        {/* Main Number: Ganancia Neta */}
        <div>
          <p className={`text-3xl sm:text-4xl font-extrabold tracking-tight leading-none ${stats.net < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {format(stats.net)}
          </p>
        </div>

        {/* Compact Footer Capsule */}
        <div className="flex items-center justify-between bg-slate-50/90 border border-slate-100 rounded-2xl py-2 px-3.5 mt-0.5 text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-slate-400 font-medium">Bruto:</span>
            <span className="font-bold text-slate-800 truncate">{format(stats.gross)}</span>
          </div>

          <div className="h-3 w-px bg-slate-200 flex-shrink-0" />

          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-slate-400 font-medium">Gastos:</span>
            <span className="font-bold text-rose-600 truncate">-{format(stats.expenses)}</span>
          </div>

          <div className="h-3 w-px bg-slate-200 flex-shrink-0" />

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="font-bold text-slate-700">{stats.servicesCount}</span>
            <span className="text-slate-400">{stats.servicesCount === 1 ? 'corte' : 'cortes'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Savings Goal Card ---
interface SavingsGoalCardProps {
  currentSaved: number;
  savingsGoal: number;
  savingsGoalName?: string;
  onGoalUpdated?: () => void;
}

export const SavingsGoalCard: React.FC<SavingsGoalCardProps> = ({ currentSaved, savingsGoal, savingsGoalName, onGoalUpdated }) => {
  const { user } = useAuth();
  const { format, symbol } = useCurrency(); // Get symbol too for input labels
  const [isExpanded, setIsExpanded] = useState(false);
  const [addAmount, setAddAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const progress = Math.min((currentSaved / savingsGoal) * 100, 100);

  const handleManualSave = async () => {
    if (!user) {
      alert("Error: Usuario no identificado.");
      return;
    }
    if (!addAmount) { return; }

    const val = parseInt(addAmount, 10);
    if (isNaN(val) || val <= 0) {
      alert("Por favor ingresa un monto válido mayor a 0.");
      return;
    }

    setLoading(true);

    try {
      // 1. Fetch current goal
      const { data: goalData, error: fetchError } = await supabase
        .from('goals')
        .select('id, current_amount')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.error('Fetch Error:', fetchError);
        throw new Error(`Error al buscar meta: ${fetchError.message}`);
      }

      if (goalData) {
        // 2a. Update existing goal
        const newTotal = (goalData.current_amount || 0) + val;
        const { error: updateError } = await supabase
          .from('goals')
          .update({ current_amount: newTotal })
          .eq('id', goalData.id);

        if (updateError) {
          console.error('Update Error:', updateError);
          throw new Error(`Error al actualizar meta: ${updateError.message}`);
        }
      } else {
        // 2b. Create new goal if none exists
        const { error: insertError } = await supabase
          .from('goals')
          .insert({
            user_id: user.id,
            name: savingsGoalName || 'Meta Inicial',
            target_amount: savingsGoal === 0 ? 1000000 : savingsGoal,
            current_amount: val,
            start_date: new Date().toISOString()
          });

        if (insertError) {
          console.error('Insert Error:', insertError);
          throw new Error(`Error al crear meta: ${insertError.message}`);
        }
      }

      // 3. Register as Transaction for History/Traceability
      // We log it as a 'transfer' or 'expense' type depending on accounting preference,
      // but 'expense' with category 'savings' makes sense for cash flow if it leaves the pocket.
      // Or 'income' if we view it as 'savings account' credit.
      // Let's use negative amount as it is money 'set aside' (expense-like flow) or positive?
      // Usually saving is a "transfer". But to show up in movements... let's make it a distinct entry.
      // Based on user request: "show manual contributions".
      await supabase.from('transactions').insert({
        user_id: user.id,
        title: `Aporte a Ahorro: ${savingsGoalName || 'Meta'}`,
        amount: -val, // Negative because it's money leaving "Liquidity" to "Savings"
        type: 'expense', // It behaves like an expense for the daily cash box
        category: 'other', // Use 'other' to start, as 'savings' might not be in DB constraints
        // We will rely on the title to identify it conceptually or update DB later
        date: new Date().toISOString(),
      });

      setAddAmount('');
      setIsExpanded(false);

      // Call parent refresh
      if (onGoalUpdated) {
        onGoalUpdated();
      } else {
        window.location.reload();
      }

    } catch (err: any) {
      console.error("Error updating savings (Detailed):", err);
      alert(`Error al guardar: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const isCompleted = progress >= 100;

  const handleClaimGoal = async () => {
    if (!confirm(`¡Felicidades por lograr tu meta "${savingsGoalName || 'Meta'}"!\n\n¿Deseas reiniciar el contador a $0 para comenzar una nueva meta?\n(El historial de tus aportes se mantendrá).`)) return;

    setLoading(true);
    try {
      const { data: goalData } = await supabase.from('goals').select('id').eq('user_id', user?.id).single();
      if (goalData) {
        await supabase.from('goals').update({ current_amount: 0 }).eq('id', goalData.id);

        // Optional: Log a "meta completada" event if we had a log table, but for now just resetting amount is enough.

        if (onGoalUpdated) onGoalUpdated();
        else window.location.reload();
      }
    } catch (e) {
      alert("Error al reiniciar meta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`bg-white rounded-[2.5rem] p-6 shadow-soft relative transition-all duration-300 ${isCompleted ? 'ring-4 ring-yellow-300' : ''}`}>
      {isCompleted && (
        <div className="absolute inset-0 z-0 bg-yellow-50/50 rounded-[2.5rem] pointer-events-none animate-pulse"></div>
      )}

      <div className="flex justify-between items-center mb-6 relative z-30">
        <div className="flex items-center gap-4">
          <div className={`size-12 rounded-full flex items-center justify-center ${isCompleted ? 'bg-yellow-100 text-yellow-500' : 'bg-pink-100 text-primary'}`}>
            <Icon name={isCompleted ? "emoji_events" : "savings"} size={24} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
              {savingsGoalName || 'MI META'}
            </span>
            <h3 className="text-xl font-bold text-slate-900 leading-tight">{format(currentSaved)}</h3>
            <p className="text-xs font-medium text-slate-400">
              {isCompleted ? '¡META COMPLETADA!' : 'Ahorro Actual (Propio)'}
            </p>
          </div>
        </div>

        {isCompleted ? (
          <button
            onClick={handleClaimGoal}
            className="relative z-50 h-12 px-4 rounded-full bg-yellow-400 flex items-center gap-2 text-white font-bold shadow-lg shadow-yellow-400/40 hover:scale-105 transition-all active:scale-95 animate-bounce-subtle"
          >
            <Icon name="restart_alt" size={20} />
            <span>Reiniciar</span>
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className={`relative z-50 size-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 transition-all duration-300 hover:bg-slate-100 hover:text-slate-600 active:scale-95 hover:shadow-md cursor-pointer ${isExpanded ? 'rotate-90' : '-rotate-45'} ${!isExpanded ? 'animate-glow-bulb border-2 border-transparent' : ''}`}
            title="Agregar Ahorro Manual"
            aria-label="Agregar Ahorro Manual"
          >
            <Icon name="arrow_forward" size={24} />
          </button>
        )}
      </div>

      {/* Custom Progress Bar with Clear Labels */}
      <div className="flex justify-between items-center text-xs font-bold text-slate-500 mb-2 mt-4">
        <span className="text-primary font-black text-sm bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
          {Math.round(progress)}% completado
        </span>
        <span className="text-slate-500 font-semibold">Meta: {format(savingsGoal)}</span>
      </div>

      <div className="relative w-full h-3 bg-slate-100 dark:bg-black/20 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full shadow-[0_0_15px_rgba(255,92,160,0.4)] transition-all duration-1000 ease-out ${isCompleted ? 'bg-yellow-400' : 'bg-primary'}`}
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      <div className="flex justify-between text-[11px] font-semibold text-slate-400">
        <span>0%</span>
        <span>100%</span>
      </div>

      {/* Expanded Manual Input Section */}
      {isExpanded && !isCompleted && (
        <div className="mt-6 pt-6 border-t border-slate-100 animate-slide-in-right relative z-50">
          <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Agregar Ahorro Manual</label>
          <div className="flex gap-2 relative z-50">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{symbol}</span>
              <input
                type="number"
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)}
                placeholder="Monto"
                className="w-full bg-slate-50 border-none rounded-xl py-3 pl-7 pr-3 text-slate-900 font-bold focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
            <button
              onClick={handleManualSave}
              disabled={loading || !addAmount}
              className="bg-slate-900 text-white px-4 rounded-xl font-bold flex items-center gap-2 hover:bg-black disabled:opacity-50 transition-all active:scale-95"
            >
              {loading ? <Icon name="sync" size={20} className="animate-spin" /> : <Icon name="add" size={20} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- KPI Grid ---
interface KpiGridProps {
  items: KPI[];
}

export const KpiGrid: React.FC<KpiGridProps> = ({ items }) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      {items.map((item, idx) => (
        <div key={idx} className="bg-white p-6 rounded-[2rem] shadow-soft flex flex-col justify-between gap-2 group hover:-translate-y-1 transition-transform duration-300 relative overflow-hidden">

          <div className="flex justify-between items-start z-10 mb-2">
            <div className={`size-10 rounded-full flex items-center justify-center ${item.iconBgClass} ${item.iconColorClass}`}>
              <Icon name={item.icon} size={20} />
            </div>
            <button className="text-slate-300 hover:text-slate-600 transition-colors">
              <Icon name="more_vert" size={20} />
            </button>
          </div>

          <div className="z-10">
            <p className="text-sm font-bold text-slate-900 mb-0.5">{item.label}</p>
            <p className="text-xs font-medium text-slate-400 mb-2">Total del mes</p>
            <p className="text-2xl font-extrabold text-slate-900 tracking-tight">{item.value}</p>
          </div>

          {/* Progress Ring / Chart placeholder */}
          <div className="absolute bottom-4 right-4 text-slate-900/5 dark:text-white/5 opacity-50 scale-150 pointer-events-none">
            {/* <Icon name={item.icon} size={64} />  Could add a big watermark icon here */}
          </div>
        </div>
      ))}
    </div>
  );
};

// --- Transactions List ---
interface TransactionsListProps {
  transactions: Transaction[];
  onEdit?: (tx: Transaction) => void;
}

export const TransactionsList: React.FC<TransactionsListProps> = ({ transactions, onEdit }) => {
  const { format } = useCurrency();

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white/50 rounded-[2.5rem] border-2 border-dashed border-slate-200 gap-4 mt-2">
        <div className="size-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
          <Icon name="history_toggle_off" size={32} />
        </div>
        <div className="text-center">
          <h4 className="text-slate-900 font-bold text-base">Aún no hay movimientos</h4>
          <p className="text-slate-400 text-xs font-medium max-w-[200px]">Registra tu primer servicio presionando el botón "+" abajo.</p>
        </div>
        <div className="animate-bounce">
          <Icon name="arrow_downward" size={24} className="text-primary/30" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {transactions.map((tx) => (
        <div key={tx.id} onClick={() => onEdit?.(tx)} className="flex items-center justify-between p-5 rounded-[1.5rem] bg-white shadow-soft hover:shadow-md transition-all cursor-pointer group">
          <div className="flex items-center gap-4">
            <div className={`size-12 rounded-full flex items-center justify-center ${tx.icon === 'content_cut' ? 'bg-pink-100 text-pink-500' : tx.icon === 'savings' ? 'bg-green-100 text-green-500' : 'bg-orange-100 text-orange-500'}`}>
              <Icon name={tx.icon} size={20} />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-900 leading-tight group-hover:text-primary transition-colors">{tx.title}</span>
                {tx.isOfflinePending && (
                   <span className="flex items-center gap-1 text-[10px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                     <Icon name="cloud_upload" size={10} className="animate-pulse" />
                     Cola
                   </span>
                 )}
              </div>
              <span className="text-xs font-medium text-slate-400">{tx.date} • {tx.time}</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-base font-bold text-slate-900">
              {format(Number(tx.amount))}
            </span>
            <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full font-bold hover:bg-slate-200 transition-colors">Ver</span>
          </div>
        </div>
      ))}
    </div>
  );
};