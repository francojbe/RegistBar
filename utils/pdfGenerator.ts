import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Transaction } from '../types';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { LOGO_BASE64 } from './logoData';

interface ReportData {
    userName: string;
    userEmail: string;
    period: string; // e.g., "Diciembre 2025"
    transactions: Transaction[];
    stats: {
        totalIncome: number;
        totalExpenses: number;
        netIncome: number;
        servicesTotal: number;
        tipsTotal: number;
        productsTotal: number; // If we track products separate from services? Assuming 'other' or based on category
        suppliesTotal: number;
        commissionRentTotal: number; // Needs logic to separate if available in transaction metadata
    };
}

export const generateMonthlyReportPDF = async (data: ReportData) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;

    // -- 1. HEADER --
    // Logo (15x15mm) at top left
    doc.addImage(LOGO_BASE64, 'PNG', margin, 10, 15, 15);

    // App Name next to logo
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(79, 70, 229); // Primary Blue
    doc.text('RegistBar', margin + 18, 19);

    // reset font
    doc.setFont('helvetica', 'normal');

    // Title shifted down
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text('Reporte Financiero Mensual', margin, 35);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generado el: ${new Date().toLocaleDateString('es-CL')}`, margin, 41);

    // Professional Info (aligned with title)
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Profesional: ${data.userName}`, pageWidth - margin, 35, { align: 'right' });
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(data.userEmail, pageWidth - margin, 41, { align: 'right' });

    // Period Badge (Visual representation) - Shifted down to Y=50
    doc.setFillColor(59, 130, 246); // Blue 500
    doc.roundedRect(margin, 50, pageWidth - (margin * 2), 12, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Período: ${data.period}`, margin + 5, 58);

    // -- 2. KPIs (Cards) --
    const startY = 75; // Shifted cards down
    const cardWidth = (pageWidth - (margin * 2) - 10) / 3;
    const cardHeight = 30;

    // Card 1: Ingresos Brutos
    doc.setFillColor(240, 253, 244); // Green 50
    doc.setDrawColor(34, 197, 94); // Green 500
    doc.roundedRect(margin, startY, cardWidth, cardHeight, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setTextColor(34, 197, 94);
    doc.text('INGRESOS BRUTOS', margin + 5, startY + 8);

    doc.setFontSize(14);
    doc.setTextColor(20, 83, 45); // Dark Green
    doc.text(`$ ${data.stats.totalIncome.toLocaleString('es-CL')}`, margin + 5, startY + 22);

    // Card 2: Gastos Totales
    doc.setFillColor(254, 242, 242); // Red 50
    doc.setDrawColor(239, 68, 68); // Red 500
    doc.roundedRect(margin + cardWidth + 5, startY, cardWidth, cardHeight, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setTextColor(239, 68, 68);
    doc.text('GASTOS TOTALES', margin + cardWidth + 10, startY + 8);

    doc.setFontSize(14);
    doc.setTextColor(127, 29, 29); // Dark Red
    doc.text(`$ ${data.stats.totalExpenses.toLocaleString('es-CL')}`, margin + cardWidth + 10, startY + 22);

    // Card 3: Utilidad Neta
    doc.setFillColor(239, 246, 255); // Blue 50
    doc.setDrawColor(59, 130, 246); // Blue 500
    doc.roundedRect(margin + (cardWidth * 2) + 10, startY, cardWidth, cardHeight, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setTextColor(59, 130, 246);
    doc.text('UTILIDAD NETA', margin + (cardWidth * 2) + 15, startY + 8);

    doc.setFontSize(14);
    doc.setTextColor(30, 58, 138); // Dark Blue
    doc.text(`$ ${data.stats.netIncome.toLocaleString('es-CL')}`, margin + (cardWidth * 2) + 15, startY + 22);


    // -- 3. DESGLOSE DE INGRESOS (Table) --
    const breakdownY = startY + 45;
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('Desglose de Ingresos', margin, breakdownY);

    autoTable(doc, {
        startY: breakdownY + 5,
        head: [['Categoría', 'Monto', '% del Total']],
        body: [
            ['Servicios', `$ ${data.stats.servicesTotal.toLocaleString('es-CL')}`, `${data.stats.totalIncome > 0 ? Math.round((data.stats.servicesTotal / data.stats.totalIncome) * 100) : 0}%`],
            ['Propinas', `$ ${data.stats.tipsTotal.toLocaleString('es-CL')}`, `${data.stats.totalIncome > 0 ? Math.round((data.stats.tipsTotal / data.stats.totalIncome) * 100) : 0}%`],
            ['Otros / Productos', `$ ${data.stats.productsTotal.toLocaleString('es-CL')}`, `${data.stats.totalIncome > 0 ? Math.round((data.stats.productsTotal / data.stats.totalIncome) * 100) : 0}%`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 10, cellPadding: 3 },
    });

    // -- 4. ESTRUCTURA DE COSTOS --
    // Use last autoTable finalY to position next section
    let finalY = (doc as any).lastAutoTable.finalY + 15;

    doc.setFontSize(12);
    doc.text('Estructura de Costos', margin, finalY);

    // Simple Bar Chart Logic (Visual only)
    // Max width for bar area
    const barAreaWidth = pageWidth - (margin * 2);
    const maxVal = Math.max(data.stats.suppliesTotal, data.stats.commissionRentTotal) || 1; // Avoid divide by zero

    const suppliesWidth = (data.stats.suppliesTotal / maxVal) * (barAreaWidth * 0.8);
    const commRentWidth = (data.stats.commissionRentTotal / maxVal) * (barAreaWidth * 0.8);

    finalY += 10;

    // Bar 1: Insumos
    if (data.stats.suppliesTotal > 0) {
        doc.setFontSize(9);
        doc.text('Insumos / Materiales', margin, finalY);
        doc.setFillColor(251, 146, 60); // Orange
        doc.rect(margin, finalY + 2, suppliesWidth, 5, 'F');
        doc.text(`$ ${data.stats.suppliesTotal.toLocaleString('es-CL')}`, margin + suppliesWidth + 5, finalY + 6);
        finalY += 15;
    }

    // Bar 2: Comisiones/Arriendo
    // Note: We might not have specific commission data derived easily from general expenses unless categorized effectively.
    // Assuming 'other' expense might be rent, or relying on expense type.
    // For now, if we don't have explicit split, we just verify total expenses.
    // If we can't split, we just list generic expenses.

    // Given current data structure, 'expense' only has category 'supply' or 'other'. Rent deduction is calculated logic in App.tsx but
    // might not be stored as a transaction unless explicitly created. 
    // Wait, transactions table has 'commission_amount' metadata on services.
    // But purely expense transactions are 'supply' or 'other'.
    // If user is rent model, rent is deducted conceptually.

    // Let's rely on what passes in 'suppliesTotal' vs 'commissionRentTotal' (which we will calculate before calling this).

    if (data.stats.commissionRentTotal > 0) {
        doc.setFontSize(9);
        doc.text('Comisiones / Arriendo', margin, finalY);
        doc.setFillColor(168, 85, 247); // Purple
        doc.rect(margin, finalY + 2, commRentWidth, 5, 'F');
        doc.text(`$ ${data.stats.commissionRentTotal.toLocaleString('es-CL')}`, margin + commRentWidth + 5, finalY + 6);
        finalY += 15;
    }

    if (data.stats.suppliesTotal === 0 && data.stats.commissionRentTotal === 0 && data.stats.totalExpenses > 0) {
        // Catch all for expenses not categorized above
        doc.text('Gastos Generales', margin, finalY);
        const genWidth = (data.stats.totalExpenses / maxVal) * (barAreaWidth * 0.8);
        doc.setFillColor(156, 163, 175); // Gray
        doc.rect(margin, finalY + 2, genWidth, 5, 'F');
        doc.text(`$ ${data.stats.totalExpenses.toLocaleString('es-CL')}`, margin + genWidth + 5, finalY + 6);
        finalY += 15;
    }



    // -- 5. DETALLE DE MOVIMIENTOS (Para Contador) --
    doc.addPage();
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(14);
    doc.text('Detalle de Movimientos', margin, 20);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Listado completo de ingresos y gastos registrados.', margin, 26);

    const tableRows = data.transactions.map(tx => {
        const isIncome = tx.type === 'income';
        const groosVal = isIncome ? (tx.gross_amount || tx.amount) : 0;
        const commVal = isIncome ? (tx.commission_amount || 0) : 0;
        const netVal = tx.amount;

        return [
            new Date(tx.rawDate).toLocaleDateString('es-CL'),
            tx.title,
            tx.category.toUpperCase(),
            isIncome ? `$ ${groosVal.toLocaleString('es-CL')}` : '-',
            isIncome && commVal > 0 ? `$ ${commVal.toLocaleString('es-CL')}` : '-',
            `$ ${Math.abs(netVal).toLocaleString('es-CL')} ${isIncome ? '(Ingreso)' : '(Gasto)'}`
        ];
    });

    autoTable(doc, {
        startY: 35,
        head: [['Fecha', 'Descripción', 'Cat.', 'Bruto (Cliente)', 'Comisión/Ret.', 'Monto Líquido']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [51, 65, 85] }, // Slate 700
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
            0: { cellWidth: 25 }, // Date
            1: { cellWidth: 'auto' }, // Desc
            2: { cellWidth: 20 }, // Cat
            3: { cellWidth: 25, halign: 'right' }, // Gross
            4: { cellWidth: 25, halign: 'right' }, // Comm
            5: { cellWidth: 35, halign: 'right' }  // Net
        }
    });

    // -- 6. FOOTER (Motivational Quote) --
    const motivationalQuote = data.stats.netIncome > 0
        ? "¡Buen trabajo! Mantener tus finanzas en orden es el primer paso para el crecimiento."
        : "Sigue registrando tus movimientos para tener control total de tu negocio.";

    // Position footer at bottom of the LAST page (which autoTable might have extended)
    const pageCount = (doc as any).internal.getNumberOfPages();
    doc.setPage(pageCount);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);

    const quoteY = doc.internal.pageSize.getHeight() - 20;
    doc.text(motivationalQuote, pageWidth / 2, quoteY, { align: 'center', maxWidth: pageWidth - 40 });

    const fileName = `Reporte_Financiero_${data.period.replace(' ', '_')}.pdf`;


    if (Capacitor.isNativePlatform()) {
        try {
            const pdfOutput = doc.output('datauristring');
            // Remove the prefix "data:application/pdf;filename=generated.pdf;base64,"
            const pdfBase64 = pdfOutput.split(',')[1];

            await Filesystem.writeFile({
                path: fileName,
                data: pdfBase64,
                directory: Directory.Documents,
            });

            const fileUri = await Filesystem.getUri({
                directory: Directory.Documents,
                path: fileName
            });

            await Share.share({
                title: 'Reporte Financiero',
                text: `Adjunto reporte financiero ${data.period}`,
                url: fileUri.uri,
                dialogTitle: 'Compartir Reporte'
            });

        } catch (error) {
            console.error('Error saving/sharing native PDF:', error);
            throw error;
        }
    } else {
        // Browser fallback
        doc.save(fileName);
    }
};
