import React, { useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import './OnboardingTour.css'; // Import custom styles safely

interface OnboardingTourProps {
    onComplete?: () => void;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({ onComplete }) => {
    useEffect(() => {
        // Check if user has already seen the tour
        const hasSeenTour = localStorage.getItem('hasSeenOnboarding');

        if (hasSeenTour === 'true') {
            return;
        }

        // Small delay to ensure DOM is fully rendered
        const timer = setTimeout(() => {
            const driverObj = driver({
                showProgress: true,
                showButtons: ['next', 'previous', 'close'],
                steps: [
                    {
                        element: 'body',
                        popover: {
                            title: '¡Bienvenido a RegistBar! 🎉',
                            description: 'Te mostraremos las funciones principales en 30 segundos. ¡Vamos!',
                            side: 'center',
                            align: 'center'
                        }
                    },
                    {
                        element: '[data-tour="fab-button"]',
                        popover: {
                            title: 'Botón de Acciones Rápidas ⚡',
                            description: 'Aquí puedes registrar servicios, propinas, gastos de insumos y escanear boletas con la cámara.',
                            side: 'left',
                            align: 'start'
                        }
                    },
                    {
                        element: '[data-tour="balance-card"]',
                        popover: {
                            title: 'Tu Balance Semanal 💰',
                            description: 'Aquí ves tu balance neto de la semana y tus ventas totales en tiempo real.',
                            side: 'bottom',
                            align: 'start'
                        }
                    },
                    {
                        element: '[data-tour="kpi-grid"]',
                        popover: {
                            title: 'Indicadores Clave 📊',
                            description: 'Revisa tu balance mensual y gastos en insumos de un vistazo.',
                            side: 'top',
                            align: 'start'
                        }
                    },
                    {
                        element: '[data-tour="advisor-tab"]',
                        popover: {
                            title: 'Aliado Inteligente 🤖✨',
                            description: 'Tu consultor de confianza. Pregúntale sobre tus finanzas, obtén consejos personalizados y análisis detallados.',
                            side: 'top',
                            align: 'center'
                        }
                    },
                    {
                        element: '[data-tour="notification-bell"]',
                        popover: {
                            title: 'Notificaciones 🔔',
                            description: 'Recibe recordatorios, consejos y alertas importantes sobre tu negocio.',
                            side: 'bottom',
                            align: 'end'
                        }
                    },
                    {
                        element: 'body',
                        popover: {
                            title: '¡Listo para empezar! 🚀',
                            description: 'Ya conoces lo básico. ¡Empieza a registrar tus ingresos y deja que RegistBar haga el resto!',
                            side: 'center',
                            align: 'center'
                        }
                    }
                ],
                onDestroyed: () => {
                    // Mark tour as completed
                    localStorage.setItem('hasSeenOnboarding', 'true');
                    onComplete?.();
                },
                // Custom styling class (styles defined in OnboardingTour.css)
                popoverClass: 'registbar-tour-popover',
                progressText: 'Paso {{current}} de {{total}}',
                nextBtnText: 'Siguiente',
                prevBtnText: 'Anterior',
                doneBtnText: '¡Entendido!',
            });

            driverObj.drive();
        }, 800); // Wait for animations to settle

        return () => clearTimeout(timer);
    }, [onComplete]);

    return null;
};
