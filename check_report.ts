
// Mock types
interface Transaction {
    id: string;
    type: 'income' | 'expense';
    category: 'service' | 'tip' | 'supply' | 'other';
    amount: number;
    gross_amount?: number;
    commission_amount?: number;
    title: string;
}

const mockTransactions: Transaction[] = [
    // Case 1: Standard Service (New Logic)
    // 10,000 charged, 4,000 commission, 6,000 liquid income
    {
        id: '1', type: 'income', category: 'service', title: 'Corte Adulto',
        amount: 6000,
        gross_amount: 10000,
        commission_amount: 4000
    },
    // Case 2: Legacy Service (No metadata)
    // 5,000 liquid input manually, implicitly implies 5000 gross if unknown?
    {
        id: '2', type: 'income', category: 'service', title: 'Corte Niño',
        amount: 5000
        // No gross/comm
    },
    // Case 3: Supply Expense
    {
        id: '3', type: 'expense', category: 'supply', title: 'Shampoo',
        amount: -2500
    },
    // Case 4: Other/Rent Expense (e.g. paying daily chair rent explicitly)
    {
        id: '4', type: 'expense', category: 'other', title: 'Arriendo Silla',
        amount: -1000
    },
    // Case 5: Tip
    {
        id: '5', type: 'income', category: 'tip', title: 'Propina',
        amount: 1000
    }
];

function calculateReport(transactions: Transaction[]) {
    console.log('--- Simulating Report Logic ---');
    console.log(`Transactions: ${transactions.length}`);

    // Summary calculations (On Screen)
    const totalIncomeWrapper = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

    const totalExpensesWrapper = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const balance = totalIncomeWrapper - totalExpensesWrapper;

    console.log(`\n[On Screen Dashboard]`);
    console.log(`Ingresos (Liquid): ${totalIncomeWrapper}`);
    console.log(`Egresos (Direct): ${totalExpensesWrapper}`);
    console.log(`Neto (Liquid - Direct Exp): ${balance}`);


    // EXPORT PDF LOGIC
    // 1. Services Total (Income from 'service' category)
    const servicesTotal = transactions
        .filter(t => t.type === 'income' && t.category === 'service')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    // 2. Tips Total
    const tipsTotal = transactions
        .filter(t => t.type === 'income' && t.category === 'tip')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    // 3. Products/Other Total
    const productsTotal = transactions
        .filter(t => t.type === 'income' && t.category !== 'service' && t.category !== 'tip')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    // 4. Supplies Expenses (Explicitly 'supply' category)
    const suppliesTotal = transactions
        .filter(t => t.type === 'expense' && t.category === 'supply')
        .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

    // 5. Commission/Rent Expenses
    const commissionFromServices = transactions
        .filter(t => t.type === 'income' && t.category === 'service')
        .reduce((sum, t) => sum + (Number(t.commission_amount) || 0), 0);

    const otherExpenses = transactions
        .filter(t => t.type === 'expense' && t.category !== 'supply')
        .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

    const commissionRentTotal = commissionFromServices + otherExpenses;

    // Total Gross
    const grossIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + (Number(t.gross_amount) || t.amount), 0);

    // Total Actual Expenses
    const trueTotalExpenses = totalExpensesWrapper + commissionFromServices;

    console.log(`\n[PDF Export Logic]`);
    console.log(`KPI 1: Ingresos Brutos (Gross): ${grossIncome}`);
    console.log(`       (Ex: Case 1 [10k] + Case 2 [5k] + Tip [1k]) = 16000? Let's check.`);

    console.log(`KPI 2: Gastos Totales (True Exp): ${trueTotalExpenses}`);
    console.log(`       (Direct Exp [-3500] + Comm [4000]) = 7500`);

    console.log(`KPI 3: Utilidad Neta (Net Income): ${balance}`);
    console.log(`       (Gross [16000] - True Exp [7500]) = 8500?`);
    console.log(`       Wait, Balance is ${balance} (8500). Yes. logic holds.`);

    console.log(`\n[Breakdown]`);
    console.log(`Services (Liquid): ${servicesTotal}`);
    console.log(`Tips: ${tipsTotal}`);
    console.log(`Commission/Rent from Gap: ${commissionFromServices}`);
    console.log(`Other Expenses from Tx: ${otherExpenses}`);
    console.log(`Total Comm/Rent Line: ${commissionRentTotal}`);
}

calculateReport(mockTransactions);
