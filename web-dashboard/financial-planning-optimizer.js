'use strict';

/**
 * Financial Planning & Budget Optimizer
 * Comprehensive household financial management and optimization
 */
class FinancialPlanningOptimizer {
  constructor(app) {
    this._intervals = [];
    this._timeouts = [];
    this.app = app;
    this.accounts = new Map();
    this.budgets = new Map();
    this.expenses = [];
    this.income = [];
    this.savings = new Map();
    this.investments = new Map();
    this.bills = new Map();
    this.financialGoals = new Map();
    this.forecasts = [];
  }

  async initialize() {
    await this.setupAccounts();
    await this.setupBudgets();
    await this.setupBills();
    await this.setupFinancialGoals();
    await this.generateSampleTransactions();
    
    this.startMonitoring();
  }

  // ============================================
  // ACCOUNT MANAGEMENT
  // ============================================

  async setupAccounts() {
    const accountData = [
      {
        id: 'checking',
        name: 'Lönekonto',
        type: 'checking',
        bank: 'Swedbank',
        balance: 45000,
        currency: 'SEK',
        primary: true
      },
      {
        id: 'savings',
        name: 'Sparkonto',
        type: 'savings',
        bank: 'Swedbank',
        balance: 180000,
        currency: 'SEK',
        interestRate: 2.5
      },
      {
        id: 'emergency',
        name: 'Buffert',
        type: 'savings',
        bank: 'Nordea',
        balance: 90000,
        currency: 'SEK',
        interestRate: 2.0
      },
      {
        id: 'investment',
        name: 'Investeringskonto',
        type: 'investment',
        bank: 'Avanza',
        balance: 350000,
        currency: 'SEK',
        returnRate: 8.5
      }
    ];

    for (const account of accountData) {
      this.accounts.set(account.id, {
        ...account,
        transactions: [],
        lastUpdated: Date.now()
      });
    }
  }

  async addTransaction(accountId, transaction) {
    const account = this.accounts.get(accountId);
    
    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    const txn = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      accountId,
      type: transaction.type, // income, expense, transfer
      category: transaction.category,
      amount: transaction.amount,
      description: transaction.description,
      date: transaction.date || Date.now(),
      recurring: transaction.recurring || false
    };

    account.transactions.push(txn);

    // Update balance
    if (txn.type === 'income') {
      account.balance += txn.amount;
      this.income.push(txn);
    } else if (txn.type === 'expense') {
      account.balance -= txn.amount;
      this.expenses.push(txn);
    }

    account.lastUpdated = Date.now();

    console.log(`💰 ${txn.type}: ${txn.amount} SEK - ${txn.description}`);

    // Check budget impact
    await this.checkBudgetImpact(txn);

    return { success: true, transaction: txn };
  }

  // ============================================
  // BUDGET MANAGEMENT
  // ============================================

  async setupBudgets() {
    const budgetData = [
      {
        id: 'housing',
        name: 'Boende',
        category: 'housing',
        monthlyLimit: 15000,
        subcategories: {
          rent: 12000,
          utilities: 2000,
          maintenance: 1000
        }
      },
      {
        id: 'food',
        name: 'Mat & Dryck',
        category: 'food',
        monthlyLimit: 8000,
        subcategories: {
          groceries: 6000,
          restaurants: 2000
        }
      },
      {
        id: 'transport',
        name: 'Transport',
        category: 'transport',
        monthlyLimit: 4000,
        subcategories: {
          fuel: 1500,
          maintenance: 1000,
          insurance: 1500
        }
      },
      {
        id: 'utilities',
        name: 'Hemkostnader',
        category: 'utilities',
        monthlyLimit: 3000,
        subcategories: {
          electricity: 1500,
          internet: 500,
          phone: 500,
          water: 500
        }
      },
      {
        id: 'entertainment',
        name: 'Nöje & Fritid',
        category: 'entertainment',
        monthlyLimit: 3000,
        subcategories: {
          streaming: 300,
          activities: 1500,
          hobbies: 1200
        }
      },
      {
        id: 'personal',
        name: 'Personligt',
        category: 'personal',
        monthlyLimit: 2000,
        subcategories: {
          clothing: 1000,
          health: 500,
          other: 500
        }
      },
      {
        id: 'savings',
        name: 'Sparande',
        category: 'savings',
        monthlyTarget: 8000,
        priority: 'high'
      }
    ];

    for (const budget of budgetData) {
      this.budgets.set(budget.id, {
        ...budget,
        spent: 0,
        remaining: budget.monthlyLimit || 0,
        lastReset: Date.now()
      });
    }
  }

  async checkBudgetImpact(transaction) {
    if (transaction.type !== 'expense') return;

    // Find matching budget
    let budget = null;
    for (const [_id, b] of this.budgets) {
      if (b.category === transaction.category) {
        budget = b;
        break;
      }
    }

    if (!budget) return;

    budget.spent += transaction.amount;
    budget.remaining = (budget.monthlyLimit || 0) - budget.spent;

    const percentUsed = (budget.spent / budget.monthlyLimit) * 100;

    if (percentUsed >= 100) {
      console.log(`⚠️ BUDGET ÖVERSKRIDNING: ${budget.name} (${budget.spent}/${budget.monthlyLimit} SEK)`);
    } else if (percentUsed >= 80) {
      console.log(`⚠️ Varning: ${budget.name} 80% använt (${budget.spent}/${budget.monthlyLimit} SEK)`);
    }
  }

  async resetMonthlyBudgets() {
    console.log('🔄 Resetting monthly budgets...');

    for (const [_id, budget] of this.budgets) {
      budget.spent = 0;
      budget.remaining = budget.monthlyLimit || 0;
      budget.lastReset = Date.now();
    }
  }

  // ============================================
  // BILLS & RECURRING PAYMENTS
  // ============================================

  async setupBills() {
    const billData = [
      {
        id: 'rent',
        name: 'Hyra',
        amount: 12000,
        category: 'housing',
        dueDay: 25,
        frequency: 'monthly',
        autoPayment: true
      },
      {
        id: 'electricity',
        name: 'El',
        amount: 1500,
        category: 'utilities',
        dueDay: 15,
        frequency: 'monthly',
        autoPayment: true,
        variable: true
      },
      {
        id: 'internet',
        name: 'Bredband',
        amount: 499,
        category: 'utilities',
        dueDay: 1,
        frequency: 'monthly',
        autoPayment: true
      },
      {
        id: 'phone',
        name: 'Mobilabonnemang',
        amount: 299,
        category: 'utilities',
        dueDay: 5,
        frequency: 'monthly',
        autoPayment: true
      },
      {
        id: 'insurance_home',
        name: 'Hemförsäkring',
        amount: 250,
        category: 'insurance',
        dueDay: 10,
        frequency: 'monthly',
        autoPayment: true
      },
      {
        id: 'insurance_car',
        name: 'Bilförsäkring',
        amount: 450,
        category: 'insurance',
        dueDay: 10,
        frequency: 'monthly',
        autoPayment: true
      },
      {
        id: 'streaming',
        name: 'Streaming-tjänster',
        amount: 299,
        category: 'entertainment',
        dueDay: 1,
        frequency: 'monthly',
        autoPayment: true
      }
    ];

    for (const bill of billData) {
      this.bills.set(bill.id, {
        ...bill,
        lastPaid: null,
        nextDue: this.calculateNextDueDate(bill),
        status: 'pending'
      });
    }
  }

  calculateNextDueDate(bill) {
    const now = new Date();
    const dueDate = new Date(now.getFullYear(), now.getMonth(), bill.dueDay);
    
    if (dueDate < now) {
      dueDate.setMonth(dueDate.getMonth() + 1);
    }

    return dueDate.getTime();
  }

  async processBills() {
    const now = Date.now();
    const threeDays = 3 * 24 * 60 * 60 * 1000;

    for (const [billId, bill] of this.bills) {
      if (bill.status === 'paid') continue;

      // Check if due soon
      if (bill.nextDue - now <= threeDays) {
        console.log(`💳 Bill due soon: ${bill.name} (${bill.amount} SEK) - Due: ${new Date(bill.nextDue).toLocaleDateString('sv-SE')}`);
        
        // Auto-pay if enabled
        if (bill.autoPayment && bill.nextDue <= now) {
          await this.payBill(billId);
        }
      }
    }
  }

  async payBill(billId) {
    const bill = this.bills.get(billId);
    
    if (!bill) {
      return { success: false, error: 'Bill not found' };
    }

    // Add as expense
    await this.addTransaction('checking', {
      type: 'expense',
      category: bill.category,
      amount: bill.amount,
      description: bill.name,
      recurring: true
    });

    bill.lastPaid = Date.now();
    bill.status = 'paid';
    bill.nextDue = this.calculateNextDueDate(bill);

    console.log(`✅ Paid: ${bill.name} (${bill.amount} SEK)`);

    // Reset status for next month
    this._timeouts.push(setTimeout(() => {
      bill.status = 'pending';
    }, 24 * 60 * 60 * 1000));

    return { success: true, bill };
  }

  // ============================================
  // FINANCIAL GOALS
  // ============================================

  async setupFinancialGoals() {
    const goalData = [
      {
        id: 'emergency_fund',
        name: 'Akutfond',
        type: 'savings',
        target: 100000,
        current: 90000,
        deadline: Date.now() + 180 * 24 * 60 * 60 * 1000, // 6 months
        priority: 'critical'
      },
      {
        id: 'vacation',
        name: 'Semesterresa',
        type: 'savings',
        target: 35000,
        current: 15000,
        deadline: Date.now() + 150 * 24 * 60 * 60 * 1000, // 5 months
        priority: 'high'
      },
      {
        id: 'home_renovation',
        name: 'Hemrenovering',
        type: 'savings',
        target: 150000,
        current: 50000,
        deadline: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
        priority: 'medium'
      },
      {
        id: 'retirement',
        name: 'Pensionssparande',
        type: 'investment',
        target: 2000000,
        current: 350000,
        deadline: Date.now() + 20 * 365 * 24 * 60 * 60 * 1000, // 20 years
        priority: 'high'
      }
    ];

    for (const goal of goalData) {
      this.financialGoals.set(goal.id, {
        ...goal,
        monthlyContribution: this.calculateRequiredMonthlyContribution(goal),
        progress: (goal.current / goal.target) * 100
      });
    }
  }

  calculateRequiredMonthlyContribution(goal) {
    const remaining = goal.target - goal.current;
    const daysUntilDeadline = (goal.deadline - Date.now()) / (1000 * 60 * 60 * 24);
    const monthsUntilDeadline = daysUntilDeadline / 30;

    if (monthsUntilDeadline <= 0) return remaining;

    return Math.ceil(remaining / monthsUntilDeadline);
  }

  async contributeToGoal(goalId, amount) {
    const goal = this.financialGoals.get(goalId);
    
    if (!goal) {
      return { success: false, error: 'Goal not found' };
    }

    goal.current += amount;
    goal.progress = (goal.current / goal.target) * 100;
    goal.monthlyContribution = this.calculateRequiredMonthlyContribution(goal);

    console.log(`🎯 Contributed ${amount} SEK to ${goal.name} (${goal.progress.toFixed(1)}% complete)`);

    if (goal.current >= goal.target) {
      console.log(`🎉 Goal achieved: ${goal.name}!`);
      goal.status = 'achieved';
      goal.achievedDate = Date.now();
    }

    return { success: true, goal };
  }

  // ============================================
  // SAMPLE TRANSACTIONS
  // ============================================

  async generateSampleTransactions() {
    // Income
    await this.addTransaction('checking', {
      type: 'income',
      category: 'salary',
      amount: 45000,
      description: 'Lön Anna',
      date: Date.now() - 15 * 24 * 60 * 60 * 1000
    });

    await this.addTransaction('checking', {
      type: 'income',
      category: 'salary',
      amount: 42000,
      description: 'Lön Erik',
      date: Date.now() - 15 * 24 * 60 * 60 * 1000
    });

    // Expenses
    const expenses = [
      { category: 'food', amount: 850, description: 'ICA Maxi' },
      { category: 'food', amount: 320, description: 'Coop' },
      { category: 'transport', amount: 650, description: 'Bensin' },
      { category: 'entertainment', amount: 450, description: 'Bio & middag' },
      { category: 'personal', amount: 1200, description: 'Kläder' },
      { category: 'food', amount: 580, description: 'Restaurang' }
    ];

    for (const expense of expenses) {
      await this.addTransaction('checking', {
        type: 'expense',
        ...expense,
        date: Date.now() - Math.random() * 20 * 24 * 60 * 60 * 1000
      });
    }
  }

  // ============================================
  // FORECASTING & PREDICTIONS
  // ============================================

  async generateForecast(months = 12) {
    console.log(`📊 Generating ${months}-month financial forecast...`);

    const forecast = [];
    
    // Calculate average monthly income
    const monthlyIncome = 87000; // Combined salaries

    // Calculate average monthly expenses
    let monthlyExpenses = 0;
    for (const [_id, budget] of this.budgets) {
      if (budget.monthlyLimit) {
        monthlyExpenses += budget.monthlyLimit;
      }
    }

    // Add recurring bills
    for (const [_id, bill] of this.bills) {
      monthlyExpenses += bill.amount;
    }

    const monthlySurplus = monthlyIncome - monthlyExpenses;

    let currentBalance = this.accounts.get('checking').balance;
    let savingsBalance = this.accounts.get('savings').balance;

    for (let month = 1; month <= months; month++) {
      currentBalance += monthlySurplus;
      
      // Move surplus to savings
      if (monthlySurplus > 0) {
        const toSavings = monthlySurplus * 0.5; // Save 50% of surplus
        currentBalance -= toSavings;
        savingsBalance += toSavings;
      }

      forecast.push({
        month,
        date: new Date(Date.now() + month * 30 * 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long' }),
        income: monthlyIncome,
        expenses: monthlyExpenses,
        surplus: monthlySurplus,
        checkingBalance: Math.round(currentBalance),
        savingsBalance: Math.round(savingsBalance),
        totalWealth: Math.round(currentBalance + savingsBalance)
      });
    }

    this.forecasts = forecast;

    return forecast;
  }

  async identifyOptimizations() {
    console.log('💡 Identifying optimization opportunities...');

    const optimizations = [];

    // Check for overspending
    for (const [_id, budget] of this.budgets) {
      const percentUsed = budget.monthlyLimit > 0 ? (budget.spent / budget.monthlyLimit) * 100 : 0;
      
      if (percentUsed > 90) {
        optimizations.push({
          type: 'reduce_spending',
          category: budget.name,
          priority: 'high',
          message: `${budget.name}: ${percentUsed.toFixed(0)}% av budget använt`,
          potentialSaving: Math.round(budget.spent * 0.1),
          action: 'Minska utgifter med 10%'
        });
      }
    }

    // Check savings rate
    const totalIncome = this.income
      .filter(i => i.date >= Date.now() - 30 * 24 * 60 * 60 * 1000)
      .reduce((sum, i) => sum + i.amount, 0);

    const totalExpenses = this.expenses
      .filter(e => e.date >= Date.now() - 30 * 24 * 60 * 60 * 1000)
      .reduce((sum, e) => sum + e.amount, 0);

    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

    if (savingsRate < 20) {
      optimizations.push({
        type: 'increase_savings',
        priority: 'high',
        message: `Sparkvot: ${savingsRate.toFixed(1)}% (rekommenderat: 20%+)`,
        potentialSaving: Math.round(totalIncome * 0.2 - (totalIncome - totalExpenses)),
        action: 'Öka månadssparande'
      });
    }

    // Check for expensive bills
    for (const [_id, bill] of this.bills) {
      if (bill.category === 'utilities') {
        // Check if can be optimized
        if (bill.amount > 500) {
          optimizations.push({
            type: 'reduce_bills',
            priority: 'medium',
            message: `${bill.name}: ${bill.amount} SEK/månad`,
            potentialSaving: Math.round(bill.amount * 0.2),
            action: 'Jämför alternativ'
          });
        }
      }
    }

    // Energy optimization
    optimizations.push({
      type: 'energy_optimization',
      priority: 'medium',
      message: 'Optimera energianvändning med smart hemautomation',
      potentialSaving: 300,
      action: 'Använd elprisoptimering och schemaläggning'
    });

    // Investment opportunities
    const checkingBalance = this.accounts.get('checking').balance;
    if (checkingBalance > 60000) {
      optimizations.push({
        type: 'investment',
        priority: 'medium',
        message: `${Math.round(checkingBalance - 50000)} SEK kan investeras`,
        potentialGain: Math.round((checkingBalance - 50000) * 0.08),
        action: 'Överväg investering för högre avkastning'
      });
    }

    return optimizations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Check bills daily
    this._intervals.push(setInterval(() => {
      this.processBills();
    }, 24 * 60 * 60 * 1000));

    // Generate weekly optimization report
    this._intervals.push(setInterval(() => {
      const day = new Date().getDay();
      if (day === 1) { // Monday
        this.generateWeeklyReport();
      }
    }, 24 * 60 * 60 * 1000));

    // Reset budgets monthly (first day of month)
    this._intervals.push(setInterval(() => {
      const date = new Date().getDate();
      if (date === 1) {
        this.resetMonthlyBudgets();
      }
    }, 24 * 60 * 60 * 1000));

    // Initial checks
    this.processBills();
  }

  async generateWeeklyReport() {
    console.log('📊 Weekly Financial Report:');
    
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    
    const weeklyIncome = this.income
      .filter(i => i.date >= weekAgo)
      .reduce((sum, i) => sum + i.amount, 0);

    const weeklyExpenses = this.expenses
      .filter(e => e.date >= weekAgo)
      .reduce((sum, e) => sum + e.amount, 0);

    console.log(`  Income: ${weeklyIncome} SEK`);
    console.log(`  Expenses: ${weeklyExpenses} SEK`);
    console.log(`  Net: ${weeklyIncome - weeklyExpenses} SEK`);

    // Budget status
    console.log('\n  Budget Status:');
    for (const [_id, budget] of this.budgets) {
      if (budget.monthlyLimit) {
        const percentUsed = (budget.spent / budget.monthlyLimit) * 100;
        console.log(`    ${budget.name}: ${percentUsed.toFixed(0)}% (${budget.spent}/${budget.monthlyLimit} SEK)`);
      }
    }

    // Financial goals
    console.log('\n  Goal Progress:');
    for (const [_id, goal] of this.financialGoals) {
      if (goal.status !== 'achieved') {
        console.log(`    ${goal.name}: ${goal.progress.toFixed(1)}% (${goal.current}/${goal.target} SEK)`);
      }
    }
  }

  // ============================================
  // REPORTING & ANALYTICS
  // ============================================

  getFinancialOverview() {
    let totalBalance = 0;
    const accounts = [];

    for (const [_id, account] of this.accounts) {
      totalBalance += account.balance;
      accounts.push({
        name: account.name,
        type: account.type,
        balance: Math.round(account.balance)
      });
    }

    const monthlyIncome = 87000;
    let monthlyExpenses = 0;

    for (const [_id, budget] of this.budgets) {
      if (budget.monthlyLimit) {
        monthlyExpenses += budget.spent;
      }
    }

    const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0;

    return {
      totalWealth: Math.round(totalBalance),
      accounts,
      monthlyIncome,
      monthlyExpenses: Math.round(monthlyExpenses),
      monthlySurplus: Math.round(monthlyIncome - monthlyExpenses),
      savingsRate: savingsRate.toFixed(1),
      upcomingBills: this.getUpcomingBills(7)
    };
  }

  getUpcomingBills(days) {
    const cutoff = Date.now() + days * 24 * 60 * 60 * 1000;
    
    return Array.from(this.bills.values())
      .filter(b => b.nextDue <= cutoff && b.status === 'pending')
      .map(b => ({
        name: b.name,
        amount: b.amount,
        dueDate: new Date(b.nextDue).toLocaleDateString('sv-SE'),
        daysUntil: Math.ceil((b.nextDue - Date.now()) / (24 * 60 * 60 * 1000))
      }))
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }

  getBudgetReport() {
    const budgets = [];
    let totalBudget = 0;
    let totalSpent = 0;

    for (const [_id, budget] of this.budgets) {
      if (budget.monthlyLimit) {
        totalBudget += budget.monthlyLimit;
        totalSpent += budget.spent;

        budgets.push({
          name: budget.name,
          limit: budget.monthlyLimit,
          spent: budget.spent,
          remaining: budget.remaining,
          percentUsed: Math.round((budget.spent / budget.monthlyLimit) * 100),
          status: budget.spent >= budget.monthlyLimit ? 'exceeded' :
                  budget.spent >= budget.monthlyLimit * 0.8 ? 'warning' : 'ok'
        });
      }
    }

    return {
      totalBudget,
      totalSpent,
      totalRemaining: totalBudget - totalSpent,
      budgets: budgets.sort((a, b) => b.percentUsed - a.percentUsed)
    };
  }

  getGoalsReport() {
    const goals = [];

    for (const [_id, goal] of this.financialGoals) {
      const daysRemaining = Math.ceil((goal.deadline - Date.now()) / (24 * 60 * 60 * 1000));
      
      goals.push({
        name: goal.name,
        target: goal.target,
        current: goal.current,
        progress: goal.progress.toFixed(1),
        monthlyContribution: goal.monthlyContribution,
        daysRemaining,
        onTrack: goal.current + (goal.monthlyContribution * (daysRemaining / 30)) >= goal.target,
        status: goal.status || 'active'
      });
    }

    return goals.sort((a, b) => b.progress - a.progress);
  }

  getCashFlowAnalysis(months = 6) {
    const monthlyData = [];

    for (let i = months - 1; i >= 0; i--) {
      const monthStart = Date.now() - i * 30 * 24 * 60 * 60 * 1000;
      const monthEnd = monthStart + 30 * 24 * 60 * 60 * 1000;

      const monthIncome = this.income
        .filter(t => t.date >= monthStart && t.date < monthEnd)
        .reduce((sum, t) => sum + t.amount, 0);

      const monthExpenses = this.expenses
        .filter(t => t.date >= monthStart && t.date < monthEnd)
        .reduce((sum, t) => sum + t.amount, 0);

      monthlyData.push({
        month: new Date(monthStart).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short' }),
        income: Math.round(monthIncome),
        expenses: Math.round(monthExpenses),
        surplus: Math.round(monthIncome - monthExpenses)
      });
    }

    return monthlyData;
  }

  getNetWorthTrend(months = 12) {
    // Calculate net worth over time
    const trend = [];
    let netWorth = 0;

    for (const [_id, account] of this.accounts) {
      netWorth += account.balance;
    }

    // Project future net worth based on savings rate
    const monthlySavings = 8000; // From budget

    for (let i = 0; i < months; i++) {
      trend.push({
        month: i,
        netWorth: Math.round(netWorth + (monthlySavings * i))
      });
    }

    return trend;
  }

  destroy() {
    if (this._intervals) {
      this._intervals.forEach(id => clearInterval(id));
      this._intervals = [];
    }
    if (this._timeouts) {
      this._timeouts.forEach(id => clearTimeout(id));
      this._timeouts = [];
    }
  }
}

module.exports = FinancialPlanningOptimizer;
