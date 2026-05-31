import { useState } from "react";
import { ShoppingList, ShoppingItem } from "../types";
import { 
  Check, 
  ShoppingCart, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  ShoppingBag,
  CheckCircle2,
  ListTodo,
  Info
} from "lucide-react";

interface SupermarketModeProps {
  lists: ShoppingList[];
  activeListId: string | null;
  onSelectList: (listId: string) => void;
  activeList: ShoppingList | null;
  items: ShoppingItem[];
  onToggleCheck: (item: ShoppingItem) => void;
  onOpenCheckout: () => void;
}

export default function SupermarketMode({
  lists,
  activeListId,
  onSelectList,
  activeList,
  items,
  onToggleCheck,
  onOpenCheckout,
}: SupermarketModeProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCheckedItems, setShowCheckedItems] = useState(false);

  // Split into active list (to buy) and checked list (already in basket)
  const pendingItems = items.filter(i => !i.checked);
  const checkedItems = items.filter(i => i.checked);

  // Filter both groups by search
  const filteredPending = pendingItems.filter(item => {
    const itemCat = item.category || "Geral";
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          itemCat.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const filteredChecked = checkedItems.filter(item => {
    const itemCat = item.category || "Geral";
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          itemCat.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Calculate metrics
  const totalItems = items.length;
  const completedCount = checkedItems.length;
  const progressPercent = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;
  
  // Cost calculations
  const basketEstimatedCost = checkedItems.reduce((acc, curr) => acc + ((curr.estimatedPrice || 0) * curr.quantity), 0);
  const totalEstimatedCost = items.reduce((acc, curr) => acc + ((curr.estimatedPrice || 0) * curr.quantity), 0);

  // Group pending items by category/aisle for smart pathing inside the warehouse
  const pendingGrouped: { [cat: string]: ShoppingItem[] } = {};
  filteredPending.forEach(item => {
    const cat = item.category || "Geral";
    if (!pendingGrouped[cat]) {
      pendingGrouped[cat] = [];
    }
    pendingGrouped[cat].push(item);
  });

  return (
    <div className="w-full max-w-md mx-auto space-y-4 px-2 select-none pb-12">
      
      {/* 1. Touch-Optimized List Selection & Checkout Panel */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <label htmlFor="mobile-list-dropdown" className="flex items-center gap-1 text-[10px] uppercase font-mono font-bold tracking-wider text-indigo-600 mb-1">
              <ListTodo className="w-3 h-3" />
              <span>Lista de Compras Ativa</span>
            </label>
            <div className="relative">
              <select
                id="mobile-list-dropdown"
                value={activeListId || ""}
                onChange={(e) => onSelectList(e.target.value)}
                className="w-full text-sm font-extrabold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl py-2 px-3 pr-8 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-ellipsis overflow-hidden"
              >
                {lists.length === 0 ? (
                  <option value="">Nenhuma lista disponível</option>
                ) : (
                  lists.map((list) => (
                    <option key={list.listId} value={list.listId}>
                      🛒 {list.title}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Quick Checkout Trigger Button */}
          {totalItems > 0 && (
            <button
              onClick={onOpenCheckout}
              className="h-10 mt-5 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 flex-shrink-0 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Concluir</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. STICKY Interactive Real-time Basket Status */}
      {totalItems > 0 && (
        <div className="sticky top-1.5 sm:top-[74px] z-30 bg-white/95 backdrop-blur border border-indigo-100/80 rounded-2xl p-3.5 shadow-md space-y-2 transition-all">
          <div className="flex justify-between items-center text-[11px] font-bold text-slate-650">
            <span className="flex items-center gap-1">
              <ShoppingCart className="w-3.5 h-3.5 text-indigo-600" />
              Carrinho: <span className="font-extrabold text-indigo-600">{completedCount}/{totalItems}</span> ({progressPercent}%)
            </span>
            <span className="font-mono text-[10px] text-slate-500">
              Total No Carrinho: <span className="font-bold text-indigo-600">R$ {basketEstimatedCost.toFixed(2)}</span>
            </span>
          </div>
          
          {/* Smooth Progress bar */}
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden relative shadow-inner border border-slate-200/30">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-indigo-600 rounded-full transition-all duration-300 relative"
              style={{ width: `${progressPercent}%` }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:16px_16px] animate-[pulse_1.5s_infinite]" />
            </div>
          </div>
        </div>
      )}

      {/* 3. High Efficiency Search Input (Closes keyboard easily) */}
      {totalItems > 0 && (
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar produto por nome ou corredor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-9 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 focus:outline-none placeholder-slate-450 font-medium shadow-sm transition-all"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-3 text-[11px] text-slate-400 hover:text-slate-600 font-bold"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* 4. ACTIVE SHOPPING LIST (PENDING ITEMS GROUPED BY CATEGORY) */}
      {totalItems > 0 && (
        <div className="space-y-4">
          
          {/* Header to highlight active items */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
              A Comprar ({pendingItems.length})
            </span>
            {searchTerm && (
              <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full">
                Buscando...
              </span>
            )}
          </div>

          {filteredPending.length === 0 ? (
            <div className="bg-slate-50/40 p-8 border border-slate-200/50 rounded-2xl text-center">
              {pendingItems.length === 0 ? (
                <div className="space-y-1.5">
                  <p className="font-extrabold text-xs text-slate-700">🎉 Tudo pronto no carrinho!</p>
                  <p className="text-[10px] text-slate-400">Clique em "Concluir" no topo para fechar a compra.</p>
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 font-medium">Nenhum pendente corresponde à busca.</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {Object.keys(pendingGrouped).map((categoryName) => {
                const catItems = pendingGrouped[categoryName];
                
                return (
                  <div key={categoryName} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs">
                    {/* Compact category sticky label */}
                    <div className="bg-slate-50/70 border-b border-slate-100 px-3 py-1.5 flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <span>🏪 Corredor: {categoryName}</span>
                      <span className="bg-slate-200/60 font-mono text-slate-600 px-1.5 py-0.2 rounded-full font-bold">
                        {catItems.length}
                      </span>
                    </div>

                    {/* Highly responsive list of target buttons */}
                    <div className="divide-y divide-slate-50">
                      {catItems.map((item) => {
                        const isEstimated = (item.estimatedPrice || 0) > 0;
                        const subTotal = (item.estimatedPrice || 0) * item.quantity;

                        return (
                          <div
                            key={item.itemId}
                            onClick={() => onToggleCheck(item)}
                            className="w-full flex items-center justify-between p-3.5 bg-white active:bg-slate-50 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {/* Giant finger-friendly checkbox circle */}
                              <div className="w-7 h-7 rounded-full border-2 border-slate-350 hover:border-indigo-500 bg-white flex items-center justify-center transition-colors flex-shrink-0">
                                <span className="w-3.5 h-3.5 rounded-full bg-slate-100 transition-colors group-active:bg-indigo-200" />
                              </div>

                              <div className="text-left min-w-0">
                                <span className="font-bold text-[13.5px] text-slate-800 tracking-tight block truncate">
                                  {item.name}
                                </span>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold mt-0.5">
                                  <span>Qtd:</span>
                                  <span className="bg-slate-100 px-1.5 py-0.2 rounded font-mono text-slate-600 font-bold">
                                    {item.quantity}
                                  </span>
                                  {isEstimated && (
                                    <>
                                      <span>•</span>
                                      <span>R$ {item.estimatedPrice!.toFixed(2)}/un</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Item total price tag */}
                            {isEstimated && (
                              <div className="text-right flex-shrink-0 font-mono text-[12.5px] font-black text-slate-700 ml-2">
                                R$ {subTotal.toFixed(2)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. SECURED IN-BASKET ITEMS (COLLAPSED BY DEFAULT) */}
      {totalItems > 0 && (
        <div className="pt-2">
          {/* Main Toggler Row */}
          <button
            onClick={() => setShowCheckedItems(!showCheckedItems)}
            className="w-full flex items-center justify-between p-3.5 bg-white hover:bg-slate-50 border border-slate-100 rounded-2xl shadow-xs transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 text-slate-700">
              <ShoppingBag className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-extrabold">
                Pegos &amp; Guardados no Carrinho ({checkedItems.length})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                R$ {basketEstimatedCost.toFixed(2)}
              </span>
              {showCheckedItems ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </div>
          </button>

          {/* Collapsible Checked List Container */}
          {showCheckedItems && (
            <div className="mt-2 space-y-2 animate-[slideDown_0.2s_ease-out]">
              {filteredChecked.length === 0 ? (
                <div className="bg-white/50 border border-dashed rounded-xl p-5 text-center text-[10px] text-slate-400">
                  {checkedItems.length === 0 
                    ? "Toque nos itens acima para movê-los ao carrinho rápida e facilmente." 
                    : "Nenhum item pego corresponde à busca."}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-50 overflow-hidden shadow-xs">
                  {filteredChecked.map((item) => {
                    const isEstimated = (item.estimatedPrice || 0) > 0;
                    const subTotal = (item.estimatedPrice || 0) * item.quantity;

                    return (
                      <div
                        key={item.itemId}
                        onClick={() => onToggleCheck(item)}
                        className="w-full flex items-center justify-between p-3.5 bg-emerald-500/[0.02] text-slate-400 hover:bg-slate-50 cursor-pointer active:scale-[0.99] transition-transform"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Checked green check circle */}
                          <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-sm shadow-emerald-200 flex-shrink-0">
                            <Check className="w-4 h-4 stroke-[3]" />
                          </div>

                          <div className="text-left min-w-0">
                            <span className="font-bold text-[13px] text-slate-400 line-through decoration-slate-300 block truncate">
                              {item.name}
                            </span>
                            <div className="flex items-center gap-1.5 text-[9px] text-slate-450 mt-0.5">
                              <span>Qtd: {item.quantity}</span>
                              {isEstimated && (
                                <>
                                  <span>•</span>
                                  <span>R$ {item.estimatedPrice!.toFixed(2)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Strikethrough price display */}
                        {isEstimated && (
                          <div className="text-right font-mono text-[12px] font-bold text-slate-400 line-through">
                            R$ {subTotal.toFixed(2)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 6. Agile Footer Hints */}
      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-start gap-2 text-[10px] text-slate-400/90 leading-tight">
        <Info className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
        <p>
          <span className="font-extrabold text-slate-500 block">Sincronização Ativa</span>
          Seus familiares sabem o que já está no carrinho em tempo real, evitando itens duplicados.
        </p>
      </div>

    </div>
  );
}
