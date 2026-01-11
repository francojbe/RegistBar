import React from 'react';
import { Tab } from '../types';
import { Icon } from './Icons';

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const navItems = [
    { tab: Tab.Home, icon: 'home' },
    { tab: Tab.Income, icon: 'receipt_long' },
    { tab: Tab.Advisor, icon: 'auto_awesome' },
    { tab: Tab.Reports, icon: 'bar_chart' },
    { tab: Tab.Profile, icon: 'person' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-lg border-t border-slate-200 z-40 pb-[env(safe-area-inset-bottom)] shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
      <div className="flex justify-around items-center h-20 px-4">
        {navItems.map((item) => {
          const isActive = activeTab === item.tab;
          return (
            <button
              key={item.tab}
              onClick={() => onTabChange(item.tab)}
              className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors group ${isActive
                ? 'text-primary'
                : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              <Icon
                name={item.icon}
                size={26}
                filled={isActive}
                className={`transition-transform ${!isActive ? 'group-hover:scale-110' : ''}`}
              />
              <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.tab}
              </span>
            </button>
          );
        })}
      </div>
      {/* Safe area spacer */}
      <div className="h-4 w-full bg-transparent"></div>
    </nav>
  );
};