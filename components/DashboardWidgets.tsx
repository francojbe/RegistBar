import React, { useState } from 'react';
import { Icon } from './Icons';
import { Transaction, KPI } from '../types';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';

// --- Savings Card (Now Income Accumulator) ---
// --- Savings Card (Now Income Accumulator) ---
interface FiscalSavingsCardProps {
  grossIncome: number;
  netIncome: number;
}

export const FiscalSavingsCard: React.FC<FiscalSavingsCardProps> = ({ grossIncome, netIncome }) => {
  return (
    <div className="w-full bg-white rounded-[2.5rem] p-8 shadow-soft relative overflow-hidden group transition-transform hover:scale-[1.01] duration-300">
      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Balance Semanal (Neto)</p>
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-extrabold leading-none text-slate-900 tracking-tighter">
                $ {grossIncome.toLocaleString('es-CL')}
              </p>
            </div>
          </div>
          <div className="p-3 rounded-full bg-primary/10 text-primary">
            <Icon name="calendar_today" size={24} />
          </div>
        </div>

        <div className="flex gap-8 mt-2">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-400 mb-1">Ventas Totales (Bruto)</span>
            <span className={`text-lg font-bold ${netIncome < 0 ? 'text-red-500' : 'text-slate-900'}`}>
              $ {netIncome.toLocaleString('es-CL')}
            </span>
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
            <h3 className="text-xl font-bold text-slate-900 leading-tight">$ {currentSaved.toLocaleString('es-CL')}</h3>
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

      {/* Custom Progress Bar */}
      <div className="relative w-full h-3 bg-slate-100 dark:bg-black/20 rounded-full mb-3 mt-4">
        {/* The Bar */}
        <div
          className={`absolute top-0 left-0 h-full rounded-full shadow-[0_0_15px_rgba(255,92,160,0.4)] transition-all duration-1000 ease-out ${isCompleted ? 'bg-yellow-400' : 'bg-primary'}`}
          style={{ width: `${progress}%` }}
        ></div>

        {/* The Moving Indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 transition-all duration-1000 ease-out z-10"
          style={{ left: `${progress}%`, transform: 'translateX(-50%) translateY(100%)' }}
        >
          <div className="bg-slate-900 text-white px-2 py-1 rounded-lg text-[10px] font-bold shadow-sm whitespace-nowrap before:content-[''] before:absolute before:left-1/2 before:-translate-x-1/2 before:bottom-full before:border-4 before:border-transparent before:border-b-slate-900">
            {Math.round(progress)}%
          </div>
        </div>
      </div>

      <div className="flex justify-between text-xs font-bold text-slate-400">
        <span>0%</span>
        <span>Meta: ${savingsGoal.toLocaleString('es-CL')}</span>
      </div>

      {/* Expanded Manual Input Section */}
      {isExpanded && !isCompleted && (
        <div className="mt-6 pt-6 border-t border-slate-100 animate-slide-in-right relative z-50">
          <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Agregar Ahorro Manual</label>
          <div className="flex gap-2 relative z-50">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
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
}

export const TransactionsList: React.FC<TransactionsListProps> = ({ transactions }) => {
  return (
    <div className="flex flex-col gap-3">
      {transactions.map((tx) => (
        <div key={tx.id} className="flex items-center justify-between p-5 rounded-[1.5rem] bg-white shadow-soft hover:shadow-md transition-all cursor-pointer group">
          <div className="flex items-center gap-4">
            <div className={`size-12 rounded-full flex items-center justify-center ${tx.icon === 'content_cut' ? 'bg-pink-100 text-pink-500' : tx.icon === 'savings' ? 'bg-green-100 text-green-500' : 'bg-orange-100 text-orange-500'}`}>
              <Icon name={tx.icon} size={20} />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold text-slate-900 leading-tight group-hover:text-primary transition-colors">{tx.title}</span>
              <span className="text-xs font-medium text-slate-400">{tx.date} • {tx.time}</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-base font-bold text-slate-900">
              ${Number(tx.amount).toLocaleString('es-CL')}
            </span>
            <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full font-bold">Ver</span>
          </div>
        </div>
      ))}
    </div>
  );
};