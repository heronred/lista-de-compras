import { useState } from "react";
import { ShoppingList, ShoppingItem } from "../types";
import { 
  Check, 
  ShoppingCart, 
  Search, 
  Eye, 
  EyeOff, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  ShoppingBag,
  CheckCircle2,
  Grid,
  List,
  SlidersHorizontal,
  ChevronRight
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
  const [hideChecked, setHideChecked] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("Todos");
  const [isCompact, setIsCompact] = useState(true); // Default to compact/ágil to avoid excessive scrolling
  const [collapsedCategories, setCollapsedCategories] = useState<{ [cat: string]: boolean }>({});

  // Get list of categories in this current list
  const availableCategories = ["Todos", ...Array.from(new Set(items.map(i => i.category || "Geral"))).filter(Boolean)];

  // Filter items based on search, category filter, and checked preference
  const filteredItems = items.filter(item => {
    const itemCat = item.category || "Geral";
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          itemCat.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === "Todos" || itemCat === activeCategory;
    const matchesHideChecked = !hideChecked || !item.checked;
    
    return matchesSearch && matchesCategory && matchesHideChecked;
  });

  // Calculate metrics
  const totalItems = items.length;
  const checkedItems = items.filter(i => i.checked).length;
  const progressPercent = totalItems > 0 ? Math.round((checkedItems / totalItems) * 105) : 0;
  const safeProgressPercent = Math.min(progressPercent, 100);
  
  // Calculate running total estimate for items inside the basket
  const basketEstimatedCost = items
    .filter(i => i.checked)
    .reduce((acc, curr) => acc + ((curr.estimatedPrice || 0) * curr.quantity), 0);
  
  const totalEstimatedCost = items
    .reduce((acc, curr) => acc + ((curr.estimatedPrice || 0) * curr.quantity), 0);

  // Group by category for cleaner display and less backtracking in supermarket aisles
  const groupedItems: { [cat: string]: ShoppingItem[] } = {};
  filteredItems.forEach(item => {
    const cat = item.category || "Geral";
    if (!groupedItems[cat]) {
      groupedItems[cat] = [];
    }
    groupedItems[cat].push(item);
  });

  // Toggle single category collapse state
  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [cat]: !prev[cat]
    }));
  };

  // Toggle collapse/expand all
  const toggleCollapseAll = (collapse: boolean) => {
    const fresh: { [cat: string]: boolean } = {};
    if (collapse) {
      Object.keys(groupedItems).forEach(cat => {
        fresh[cat] = true;
      });
    }
    setCollapsedCategories(fresh);
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto px-1 sm:px-0">
      {/* Selector & Top Widget */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-3">
        <div className="flex flex-row items-center justify-between gap-1">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[10px] uppercase font-mono font-bold tracking-wider text-indigo-600">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Modo Supermercado Ágil</span>
            </div>
            
            {/* List Selector Dropdown */}
            <div className="mt-1 flex items-center gap-1">
              <select
                id="list-selector-super"
                value={activeListId || ""}
                onChange={(e) => onSelectList(e.target.value)}
                className="font-display font-extrabold text-base sm:text-lg text-slate-800 bg-transparent hover:bg-slate-50 border-0 border-b-2 border-indigo-200 focus:border-indigo-600 focus:ring-0 py-0.5 px-0.5 cursor-pointer max-w-xs truncate focus:outline-none"
              >
                {lists.length === 0 ? (
                  <option value="">Nenhuma lista cadastrada</option>
                ) : (
                  lists.map((list) => (
                    <option key={list.listId} value={list.listId}>
                      {list.title}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Checkout Trigger button */}
          {totalItems > 0 && (
            <button
              onClick={onOpenCheckout}
              className="py-2 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 flex-shrink-0 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Concluir</span>
            </button>
          )}
        </div>

        {/* Dynamic Progress Dashboard with mini metrics */}
        {totalItems > 0 && (
          <div className="bg-slate-50 rounded-xl p-3 space-y-2 border border-slate-100">
            <div className="flex justify-between items-center text-[11px] font-bold text-slate-600">
              <span className="flex items-center gap-1 text-slate-700">
                <ShoppingCart className="w-3.5 h-3.5 text-slate-400" />
                Carrinho: <span className="font-extrabold text-indigo-600">{checkedItems}/{totalItems}</span> ({safeProgressPercent}%)
              </span>
              <span className="font-mono text-slate-500 text-[10px] sm:text-[11px]">
                Estimado no Carrinho: <span className="font-bold text-slate-700">R$ {basketEstimatedCost.toFixed(2)}</span>
              </span>
            </div>
            
            {/* Progress line indicator */}
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden relative shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-indigo-600 rounded-full transition-all duration-300 relative"
                style={{ width: `${safeProgressPercent}%` }}
              >
                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:16px_16px] animate-[pulse_1.5s_infinite]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tactically designed focus toolbar */}
      {totalItems > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
            {/* Agile Search input */}
            <div className="relative sm:col-span-6">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Rápida busca na lista..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-7 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none placeholder-slate-400 font-medium shadow-sm transition-all"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-2.5 text-[10px] text-slate-450 hover:text-slate-600 font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick action controls (Hide Checked, Toggle Density, Accordions) */}
            <div className="flex items-center gap-1.5 sm:col-span-6 justify-between sm:justify-end flex-wrap">
              {/* Expand / Collapse All shortcuts */}
              <div className="flex items-center rounded-lg bg-slate-100 p-0.5 border border-slate-200/65">
                <button
                  type="button"
                  onClick={() => toggleCollapseAll(false)}
                  title="Expandir todas seções"
                  className="px-2 py-1 rounded text-[10px] font-bold text-slate-600 hover:bg-white transition-all cursor-pointer"
                >
                  Expandir
                </button>
                <span className="text-slate-300 pointer-events-none select-none text-[9px]">|</span>
                <button
                  type="button"
                  onClick={() => toggleCollapseAll(true)}
                  title="Recolher todas seções"
                  className="px-2 py-1 rounded text-[10px] font-bold text-slate-600 hover:bg-white transition-all cursor-pointer"
                >
                  Recolher
                </button>
              </div>

              {/* View Layout Selector (DENSE vs LARGE) */}
              <button
                onClick={() => setIsCompact(!isCompact)}
                className={`p-1.5 border rounded-xl shadow-xs transition-all flex items-center gap-1 text-[11px] font-bold cursor-pointer bg-white border-slate-200 ${
                  isCompact ? "text-indigo-600 border-indigo-100 bg-indigo-50/20" : "text-slate-500"
                }`}
                title={isCompact ? "Alternar para visualização espaçosa" : "Alternar para visualização compacta/ágil"}
              >
                {isCompact ? <Grid className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{isCompact ? "Ágil/Compacto" : "Espaçoso"}</span>
              </button>

              {/* Toggle hide checked item */}
              <button
                onClick={() => setHideChecked(!hideChecked)}
                className={`p-1.5 border rounded-xl shadow-xs text-[11px] font-bold cursor-pointer transition-all flex items-center gap-1 ${
                  hideChecked 
                    ? "bg-indigo-600 border-indigo-600 text-white" 
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-350"
                }`}
                title="Esconder os itens que já foram colocados no carrinho"
              >
                {hideChecked ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>Pegos</span>
              </button>
            </div>
          </div>

          {/* WRAPPING category filters - Resolves X overflow completely! */}
          {totalItems > 0 && availableCategories.length > 2 && (
            <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100">
              <div className="text-[9px] font-bold text-slate-400 mb-1.5 uppercase tracking-wide flex items-center gap-1">
                <SlidersHorizontal className="w-2.5 h-2.5" />
                <span>Filtrar Corredor / Categoria:</span>
              </div>
              <div className="flex flex-wrap gap-1 text-xs">
                {availableCategories.map((cat, idx) => {
                  const isFiltered = cat === activeCategory;
                  const countLeft = cat === "Todos"
                    ? items.filter(i => !i.checked).length
                    : items.filter(i => (i.category || "Geral") === cat && !i.checked).length;

                  return (
                    <button
                      key={idx}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg transition-all border whitespace-nowrap cursor-pointer flex items-center gap-1 text-[11px] font-medium ${
                        isFiltered 
                          ? "bg-slate-900 border-slate-900 text-white font-bold"
                          : "bg-white hover:bg-slate-50 border-slate-200 text-slate-500 shadow-sm"
                      }`}
                    >
                      <span>{cat}</span>
                      <span className={`text-[9px] font-mono leading-none rounded-full px-1 py-0.5 font-bold ${
                        isFiltered ? "bg-indigo-800 text-indigo-100" : "bg-slate-100 text-slate-400"
                      }`}>
                        {countLeft}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* COLLAPSIBLE CATEGORY ACCORDIONS - Reduz drasticamente o Scroll */}
      {totalItems === 0 ? (
        <div className="bg-white border border-slate-100 rounded-3xl p-10 text-center shadow-sm max-w-sm mx-auto space-y-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full w-fit mx-auto">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <p className="font-extrabold text-slate-800 text-sm">Sua lista está vazia!</p>
          <p className="text-xs text-slate-400 leading-normal">
            Cadastre os produtos clicando na aba "Listas Compartilhadas" primeiro.
          </p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-slate-50 p-8 border border-slate-200/50 rounded-2xl text-center text-slate-400 max-w-sm mx-auto">
          <p className="font-bold text-xs text-slate-600">Nenhum produto correspondente</p>
          <p className="text-[10px] text-slate-400 mt-1">
            Seus filtros ocultaram todos os produtos. Tente desmarcar opções ou limpar a busca.
          </p>
          <button
            onClick={() => {
              setSearchTerm("");
              setActiveCategory("Todos");
              setHideChecked(false);
            }}
            className="mt-3 px-3 py-1 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-50 cursor-pointer shadow-sm"
          >
            Resetar Filtros
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.keys(groupedItems).map((categoryName) => {
            const catItems = groupedItems[categoryName];
            const isCollapsed = !!collapsedCategories[categoryName];
            const uncheckedCount = catItems.filter(i => !i.checked).length;
            const completedCount = catItems.filter(i => i.checked).length;

            return (
              <div 
                key={categoryName} 
                className={`bg-white border rounded-2xl shadow-sm transition-all overflow-hidden ${
                  isCollapsed ? "border-slate-100 opacity-85 hover:opacity-100" : "border-slate-200/80"
                }`}
              >
                {/* Accordion header with counters */}
                <div 
                  onClick={() => toggleCategory(categoryName)}
                  className="flex items-center justify-between p-3 bg-slate-50/70 hover:bg-slate-50 border-b border-slate-100 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}
                    <span className="font-extrabold text-xs text-slate-700 uppercase tracking-wider truncate">
                      {categoryName}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 font-mono">
                      ({uncheckedCount} a comprar {completedCount > 0 && `• ${completedCount} no carrinho`})
                    </span>
                  </div>
                  
                  {/* Quick visual check for fully completed category */}
                  {uncheckedCount === 0 && catItems.length > 0 && (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full select-none flex items-center gap-1 animate-pulse">
                      <Check className="w-3 h-3 stroke-[3]" /> Completo
                    </span>
                  )}
                </div>

                {/* List items with selected Density */}
                {!isCollapsed && (
                  <div className={`p-1.5 sm:p-2 divide-y divide-slate-50 bg-white ${
                    isCompact ? "space-y-1" : "space-y-2"
                  }`}>
                    {catItems.map((item) => {
                      const isEstimated = (item.estimatedPrice || 0) > 0;
                      
                      return (
                        <div
                          key={item.itemId}
                          onClick={() => onToggleCheck(item)}
                          className={`group flex items-center justify-between transition-all cursor-pointer relative rounded-xl border border-transparent select-none active:scale-[0.99] duration-100 ${
                            item.checked 
                              ? "bg-emerald-500/[0.03] text-slate-400 opacity-60 hover:opacity-80" 
                              : "bg-white hover:bg-slate-50/70 text-slate-700"
                          } ${
                            isCompact ? "p-2 text-xs" : "p-3.5 text-sm"
                          }`}
                        >
                          {/* Super Sized Target touch circle / checkbox */}
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`rounded-lg border-2 flex items-center justify-center transition-all duration-150 flex-shrink-0 ${
                              item.checked 
                                ? "bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-100" 
                                : "border-slate-300 bg-white hover:border-indigo-500"
                            } ${
                              isCompact ? "w-6 h-6 rounded-md" : "w-7.5 h-7.5 rounded-lg"
                            }`}>
                              {item.checked ? (
                                <Check className={`${isCompact ? "w-3.5 h-3.5 stroke-[3]" : "w-4 h-4 stroke-[3.5]"}`} />
                              ) : (
                                <div className="w-2 h-2 bg-transparent rounded-xs group-hover:bg-indigo-50" />
                              )}
                            </div>

                            <div className="text-left truncate">
                              <span className={`font-bold tracking-tight block truncate ${
                                item.checked ? "line-through text-slate-400 decoration-slate-300 font-medium" : "text-slate-800"
                              } ${
                                isCompact ? "text-xs" : "text-[14px]"
                              }`}>
                                {item.name}
                              </span>
                              
                              <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400 font-medium select-none">
                                <span>Qtd: <span className="font-mono text-slate-700 font-bold bg-slate-100/85 px-1.5 py-0.2 rounded-sm">{item.quantity}</span></span>
                                {isEstimated && (
                                  <>
                                    <span>•</span>
                                    <span>R$ {item.estimatedPrice!.toFixed(2)}/un</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Item total value display */}
                          {isEstimated && (
                            <div className="text-right flex-shrink-0 ml-2">
                              <span className={`font-mono font-extrabold text-slate-700 block ${
                                item.checked ? "text-slate-400 line-through font-bold" : "text-slate-800"
                              } ${
                                isCompact ? "text-[11px]" : "text-[13px]"
                              }`}>
                                R$ {(item.estimatedPrice! * item.quantity).toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sincronização Indicator */}
      {totalItems > 0 && (
        <div className="text-center py-1">
          <p className="text-[10px] text-slate-400/80 font-medium flex items-center justify-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-400 animate-pulse" />
            <span>Sincronizando em tempo real com seu grupo familiar.</span>
          </p>
        </div>
      )}
    </div>
  );
}
