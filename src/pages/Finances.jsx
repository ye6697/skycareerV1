import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  Plane,
  Users,
  Fuel,
  Wrench,
  Building2
} from "lucide-react";

import StatCard from "@/components/dashboard/StatCard";
import CreditInfoCard from "@/components/finance/CreditInfoCard";
import LevelBonusInfo from "@/components/finance/LevelBonusInfo";

export default function Finances() {
  const [period, setPeriod] = useState('week');

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const { data: company } = useQuery({
    queryKey: ['company', currentUser?.company_id],
    queryFn: async () => {
      if (currentUser?.company_id) {
        const companies = await base44.entities.Company.filter({ id: currentUser.company_id });
        if (companies[0]) return companies[0];
      }
      const companies = await base44.entities.Company.filter({ created_by: currentUser.email });
      return companies[0];
    },
    enabled: !!currentUser
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', company?.id],
    queryFn: async () => {
      return await base44.entities.Transaction.filter({ company_id: company.id }, '-date');
    },
    enabled: !!company?.id
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', company?.id],
    queryFn: async () => {
      return await base44.entities.Employee.filter({ company_id: company.id, status: 'available' });
    },
    enabled: !!company?.id
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  // Calculate totals
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const monthlySalaries = employees.reduce((sum, e) => sum + (e.salary_per_month || 0), 0);

  // Group expenses by category
  const expensesByCategory = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + (t.amount || 0);
      return acc;
    }, {});

  const categoryLabels = {
    fuel: 'Treibstoff',
    salary: 'Gehälter',
    maintenance: 'Wartung',
    aircraft_purchase: 'Flugzeugkauf',
    insurance: 'Versicherung',
    airport_fees: 'Flughafengebühren',
    other: 'Sonstiges'
  };

  const categoryColors = {
    fuel: '#f59e0b',
    salary: '#3b82f6',
    maintenance: '#ef4444',
    aircraft_purchase: '#8b5cf6',
    insurance: '#06b6d4',
    airport_fees: '#84cc16',
    other: '#6b7280'
  };

  const pieData = Object.entries(expensesByCategory).map(([category, amount]) => ({
    name: categoryLabels[category] || category,
    value: amount,
    color: categoryColors[category] || '#6b7280'
  }));

  // Generate chart data (simplified - would need more data in production)
  const chartData = [
    { name: 'Woche 1', einnahmen: 5000, ausgaben: 2000 },
    { name: 'Woche 2', einnahmen: 8000, ausgaben: 3500 },
    { name: 'Woche 3', einnahmen: 6500, ausgaben: 2800 },
    { name: 'Woche 4', einnahmen: 12000, ausgaben: 4500 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Finanzen</h1>
          <p className="text-slate-400">Übersicht deiner Einnahmen und Ausgaben</p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <StatCard
            title="Kontostand"
            value={formatCurrency(company?.balance)}
            icon={Wallet}
            color="blue"
          />
          <StatCard
            title="Gesamteinnahmen"
            value={formatCurrency(totalIncome)}
            icon={TrendingUp}
            color="green"
          />
          <StatCard
            title="Gesamtausgaben"
            value={formatCurrency(totalExpenses)}
            icon={TrendingDown}
            color="red"
          />
          <StatCard
            title="Monatl. Gehälter"
            value={formatCurrency(monthlySalaries)}
            subtitle={`${employees.length} Mitarbeiter`}
            icon={Users}
            color="purple"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Chart */}
          <Card className="lg:col-span-2 p-6 bg-slate-800 border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Einnahmen vs. Ausgaben</h3>
              <Tabs value={period} onValueChange={setPeriod}>
                <TabsList>
                  <TabsTrigger value="week">Woche</TabsTrigger>
                  <TabsTrigger value="month">Monat</TabsTrigger>
                  <TabsTrigger value="year">Jahr</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px'
                  }}
                  formatter={(value) => formatCurrency(value)}
                />
                <Area 
                  type="monotone" 
                  dataKey="einnahmen" 
                  stackId="1"
                  stroke="#10b981" 
                  fill="#10b981" 
                  fillOpacity={0.3}
                  name="Einnahmen"
                />
                <Area 
                  type="monotone" 
                  dataKey="ausgaben" 
                  stackId="2"
                  stroke="#ef4444" 
                  fill="#ef4444" 
                  fillOpacity={0.3}
                  name="Ausgaben"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* Expense Breakdown */}
          <Card className="p-6 bg-slate-800 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-6">Ausgabenverteilung</h3>
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-4">
                  {pieData.map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-slate-300">{item.name}</span>
                      </div>
                      <span className="font-medium">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center text-slate-400 py-8">
                Noch keine Ausgaben vorhanden
              </div>
            )}
          </Card>
        </div>

        {/* Credit & Level Bonus Info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <CreditInfoCard company={company} />
          <LevelBonusInfo company={company} />
        </div>

        {/* Recent Transactions */}
        <Card className="p-6 bg-slate-800 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Letzte Transaktionen</h3>
          {transactions.length > 0 ? (
            <div className="space-y-3">
              {transactions.slice(0, 10).map((transaction) => (
                <div 
                  key={transaction.id} 
                  className="flex items-center justify-between p-3 bg-slate-900 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      transaction.type === 'income' ? 'bg-emerald-100' : 'bg-red-100'
                    }`}>
                      {transaction.type === 'income' ? (
                        <TrendingUp className={`w-4 h-4 text-emerald-600`} />
                      ) : (
                        <TrendingDown className={`w-4 h-4 text-red-600`} />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-white">{transaction.description || categoryLabels[transaction.category]}</p>
                      <p className="text-sm text-slate-400">
                        {new Date(transaction.date).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                  </div>
                  <span className={`font-semibold ${
                    transaction.type === 'income' ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    {transaction.type === 'income' ? '+' : ''}{formatCurrency(Math.abs(transaction.amount))}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-slate-400 py-8">
              Noch keine Transaktionen vorhanden
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}