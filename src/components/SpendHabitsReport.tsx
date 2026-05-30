import { useState } from "react";
import { TrendingUp, RefreshCw, Sparkles, PiggyBank, DollarSign, Calendar, Heart, Shield } from "lucide-react";
import { ExpenseRecord, ShoppingItem, AIHabitsReport } from "../types";

interface SpendHabitsReportProps {
  expenses: ExpenseRecord[];
  currentListItems: ShoppingItem[];
  familyId: string;
}

export default function SpendHabitsReport({ expenses, currentListItems, familyId }: SpendHabitsReportProps) {
  const [loading, setLoading] = useState(false);
  const [aiReport, setAiReport] = useState<AIHabitsReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalHistorical = expenses.reduce((acc, curr) => acc + curr.totalSpent, 0);
  const averageSpent = expenses.length > 0 ? totalHistorical / expenses.length : 0;
  const currentListEstimate = currentListItems.reduce((acc, item) => acc + ((item.estimatedPrice || 0) * item.quantity), 0);

  const handleGenerateReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/gemini/habits-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenses: expenses.map(e => ({
            totalSpent: e.totalSpent,
            itemsCount: e.itemsCount,
            spentAt: e.spentAt,
          })),
          currentListItems: currentListItems.map(item => ({
            name: item.name,
            quantity: item.quantity,
            category: item.category,
            estimatedPrice: item.estimatedPrice,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Erro de rede ao computar relatório de consumo.");
      }

      const data = await response.json();
      setAiReport(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Não foi possível estimar o orçamento. Certifique-se de configurar a API Key.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Histórico Total</span>
            <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-800">
            R$ {totalHistorical.toFixed(2)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Total gasto em {expenses.length} idas ao mercado registradas.
          </p>
        </div>

        <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Média por Compra</span>
            <div className="p-1.5 bg-sky-50 rounded-lg text-sky-600">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-800">
            R$ {averageSpent.toFixed(2)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Média financeira de compras compartilhada com a família.
          </p>
        </div>

        <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 p-5 shadow-sm relative overflow-hidden bg-gradient-to-br from-indigo-500/5 to-slate-500/5">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Previsão por IA</span>
            <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-700 animate-pulse">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-800">
            {aiReport ? `R$ ${aiReport.predictedMonthlySpent.toFixed(2)}` : "Não gerado"}
          </div>
          <p className="text-[11px] text-indigo-600 mt-1 font-medium">
            {aiReport ? "Estimativa mensal individualizada" : "Aperte no botão para calcular"}
          </p>
        </div>
      </div>

      {/* Visual Comparison: Estimate vs Real Cupom Fiscal scanned */}
      <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-100 p-5 shadow-sm">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-800">Comparativo de Gasto: Estimado vs Real (NFs)</h4>
            <p className="text-[10px] text-slate-400">Verifique se suas estimativa prévia de compras condiz com o cupom de checkout digitalizado por IA</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Estimate Card */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
            <div>
              <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Estimativa da Lista Atual</span>
              <span className="text-xl font-extrabold font-mono text-slate-700 mt-1 block">
                R$ {currentListEstimate.toFixed(2)}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              Soma calculada com base nos preços estimados/opcionais dos {currentListItems.length} produtos do carrinho.
            </p>
          </div>

          {/* Real Scanned Card */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-100 flex flex-col justify-between font-medium">
            <div>
              <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Última Compra Real (NF-e)</span>
              <span className="text-xl font-extrabold font-mono text-indigo-600 mt-1 block">
                R$ {expenses.length > 0 ? expenses[0].totalSpent.toFixed(2) : "0.00"}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              {expenses.length > 0 
                ? `Nota fiscal de R$ ${expenses[0].totalSpent.toFixed(2)} importada por ${expenses[0].shopperName}.`
                : "Nenhum cupom fiscal escaneado ou finalizado ainda."}
            </p>
          </div>
        </div>

        {/* Feedback visual comparing values */}
        {currentListEstimate > 0 && expenses.length > 0 && (
          <div className={`mt-4 p-3 rounded-xl border text-xs flex items-center justify-between font-medium ${
            expenses[0].totalSpent <= currentListEstimate
              ? "bg-emerald-50 border-emerald-100 text-emerald-800"
              : "bg-amber-50 border-amber-100 text-amber-800"
          }`}>
            <span>
              {expenses[0].totalSpent <= currentListEstimate
                ? `🎉 Excelente! Economia de R$ ${(currentListEstimate - expenses[0].totalSpent).toFixed(2)}! Você gastou menos do que sua estimativa prévia.`
                : `⚠️ Alerta: A compra final excedeu sua estimativa de compras por R$ ${(expenses[0].totalSpent - currentListEstimate).toFixed(2)}.`}
            </span>
          </div>
        )}
      </div>

      {/* Habits triggers and reports */}
      <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h4 className="text-base font-semibold text-slate-800">Análise de Consumo e Orçamentos</h4>
            <p className="text-xs text-slate-500">Compare gastos passados com projeções e insights gerados pela IA</p>
          </div>
          <button
            onClick={handleGenerateReport}
            disabled={loading}
            className="self-start sm:self-center py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Calculando hábitos...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                <span>Gerar Orçamento / IA Insights</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-xs mb-4">
            {error}
          </div>
        )}

        {!aiReport ? (
          <div className="flex flex-col items-center justify-center py-10 border border-dashed border-slate-100 rounded-xl bg-slate-50/50">
            <PiggyBank className="w-10 h-10 text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-600">Nenhum relatório gerado ainda</p>
            <p className="text-xs text-slate-400 max-w-sm text-center mt-1 px-4">
              Clique acima para alimentar a Inteligência Artificial do Google Gemini com a sua lista atual e histórico de despesas para prever seus gastos mais precisos!
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Visual recommendation bars via Custom SVG */}
            <div>
              <h5 className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">Recomendação de Limite por Categorias</h5>
              <div className="space-y-3">
                {aiReport.categorySpendRecommendation.map((rec, idx) => {
                  // Find average or just estimate proportional progress fills
                  const maxVal = Math.max(...aiReport.categorySpendRecommendation.map(r => r.suggestedLimit), 1);
                  const pct = Math.min((rec.suggestedLimit / maxVal) * 100, 100);

                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-700">{rec.category}</span>
                        <span className="font-mono text-slate-500 font-bold">Limite Sugerido: R$ {rec.suggestedLimit.toFixed(2)}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-1000"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Analysis Box */}
            <div className="bg-indigo-50/45 rounded-xl p-4 border border-indigo-50">
              <div className="flex gap-2.5">
                <Heart className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-indigo-800">Como você consome:</p>
                  <p className="text-xs leading-relaxed text-indigo-900/85 whitespace-pre-line font-medium">
                    {aiReport.habitsComparison}
                  </p>
                </div>
              </div>
            </div>

            {/* Savings suggestions */}
            <div>
              <h5 className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">Dicas de Economia Inteligente (IA)</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {aiReport.savingsTips.map((tip, idx) => (
                  <div key={idx} className="bg-slate-50/50 p-3 rounded-lg border border-slate-100 flex gap-2.5 items-start">
                    <div className="w-5 h-5 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 border border-indigo-100 text-[10px] font-bold flex-shrink-0 font-mono">
                      {idx + 1}
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-slate-700">Dica Prática</p>
                      <p className="text-xs text-slate-500 leading-relaxed">{tip}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Historical Purchases Logs */}
      <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-100 p-6 shadow-sm">
        <h4 className="text-sm font-semibold text-slate-800 mb-3">Histórico Recente de Compras</h4>
        {expenses.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">Nenhuma compra finalizada registrada no sistema.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {expenses.map((expense, idx) => (
              <div key={idx} className="flex justify-between items-center py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-xs font-bold text-slate-700">Compras finalizadas em mercado</p>
                  <p className="text-[10px] text-slate-400">
                    Por {expense.shopperName} • {expense.itemsCount} itens comprados
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold font-mono text-slate-800">
                    R$ {expense.totalSpent.toFixed(2)}
                  </p>
                  <p className="text-[9px] text-slate-400">
                    {new Date(expense.spentAt?.toDate ? expense.spentAt.toDate() : expense.spentAt).toLocaleDateString("pt-BR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
