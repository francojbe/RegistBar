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
          const isAdvisor = item.tab === Tab.Advisor;

          return (
            <button
              key={item.tab}
              onClick={() => onTabChange(item.tab)}
              data-tour={isAdvisor ? 'advisor-tab' : undefined}
              className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors group relative ${isActive
                ? 'text-primary'
                : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              <div className="relative">
                {/* AI Sparkle Effect */}
                {isAdvisor && (
                  <div className="absolute inset-0 pointer-events-none overflow-visible">
                    <div className="sparkle-star top-[-4px] right-[-2px] animate-[star-sparkle_1.5s_infinite] bg-yellow-400"></div>
                    <div className="sparkle-star bottom-[-2px] left-[-4px] animate-[star-sparkle_2s_infinite_0.5s] bg-purple-400" style={{ width: '6px', height: '6px' }}></div>
                    <div className="sparkle-star top-[4px] left-[-8px] animate-[star-sparkle_1.8s_infinite_0.2s] bg-blue-400"></div>
                    <div className="sparkle-star bottom-[-6px] right-[-4px] animate-[star-sparkle_2.5s_infinite_0.8s] bg-pink-400" style={{ width: '3px', height: '3px' }}></div>
                  </div>
                )}

                <Icon
                  name={item.icon}
                  size={26}
                  filled={isActive}
                  className={`transition-all duration-500 ${!isActive ? 'group-hover:scale-110' : ''} ${isAdvisor ? 'animate-[ai-glow_2s_infinite_alternate]' : ''}`}
                />
              </div>
              <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.tab}
              </span>

              {/* Underlying приглашение (invitation) glow for Advisor */}
              {isAdvisor && !isActive && (
                <div className="absolute bottom-4 w-8 h-1 bg-primary/20 blur-md animate-pulse"></div>
              )}
            </button>
          );
        })}
      </div>
      {/* Safe area spacer */}
      <div className="h-4 w-full bg-transparent"></div>
    </nav>
  );
};