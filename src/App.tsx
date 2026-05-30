import { useState, useEffect } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  serverTimestamp,
  writeBatch
} from "firebase/firestore";
import { 
  auth, 
  db, 
  googleProvider, 
  handleFirestoreError, 
  OperationType 
} from "./firebase";
import { UserProfile, Family, ShoppingList, ShoppingItem, ExpenseRecord } from "./types";
import NFScanner from "./components/NFScanner";
import SpendHabitsReport from "./components/SpendHabitsReport";
import AlertNotificationCenter from "./components/AlertNotificationCenter";
import { 
  ShoppingBag, 
  LogOut, 
  Plus, 
  Trash2, 
  Check, 
  Users, 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  ListTodo, 
  Share2, 
  Calendar, 
  CheckCircle2, 
  ShoppingCart,
  X,
  CreditCard,
  User,
  ExternalLink,
  ChevronRight,
  UserPlus
} from "lucide-react";

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(true);
  
  // App UI Views
  const [activeTab, setActiveTab] = useState<"lists" | "report">("lists");
  const [showQrJoin, setShowQrJoin] = useState(false);
  const [familyInputToken, setFamilyInputToken] = useState("");
  const [newFamilyName, setNewFamilyName] = useState("");
  const [newListName, setNewListName] = useState("");
  
  // DB Lists state
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [activeList, setActiveList] = useState<ShoppingList | null>(null);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);

  // Item creator input
  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState(1);
  const [itemCat, setItemCat] = useState("Mercearia");
  const [itemPrice, setItemPrice] = useState("");

  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [finalInvoiceAmount, setFinalInvoiceAmount] = useState("");

  // Category list defaults
  const categories = ["Mercearia", "Laticínios", "Frutas e Verduras", "Carnes", "Bebidas", "Padaria", "Limpeza", "Higiene", "Sobremesas", "Pet Shop", "Outros"];
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>("Tudo");

  // Track Auth and profile state
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await ensureUserProfile(currentUser);
      } else {
        setUser(null);
        setProfile(null);
        setFamily(null);
        setLists([]);
        setActiveListId(null);
        setItems([]);
      }
      setLoading(false);
    });
    return () => unsubAuth();
  }, []);

  // Sync user profile state in real-time
  useEffect(() => {
    if (!user) return;
    const unsubProfile = onSnapshot(doc(db, "users", user.uid), async (docSnap) => {
      if (docSnap.exists()) {
        const uProf = docSnap.data() as UserProfile;
        setProfile(uProf);
        
        // Load linked family details
        if (uProf.familyId) {
          const famSnap = await getDoc(doc(db, "families", uProf.familyId));
          if (famSnap.exists()) {
            setFamily(famSnap.data() as Family);
          }
        } else {
          setFamily(null);
        }
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
    });
    return () => unsubProfile();
  }, [user]);

  // Sync shared grocery lists of this family
  useEffect(() => {
    if (!profile?.familyId) return;
    
    const queryPath = "shopping_lists";
    const q = query(
      collection(db, queryPath),
      where("familyId", "==", profile.familyId),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const result: ShoppingList[] = [];
      snapshot.forEach((d) => {
        result.push({ listId: d.id, ...d.data() } as ShoppingList);
      });
      setLists(result);
      if (result.length > 0 && !activeListId) {
        // Auto select first list
        setActiveListId(result[0].listId);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, queryPath);
    });

    return () => unsubscribe();
  }, [profile?.familyId]);

  // Sync selected list items
  useEffect(() => {
    if (!activeListId) {
      setItems([]);
      setActiveList(null);
      return;
    }

    const currentActive = lists.find(l => l.listId === activeListId);
    if (currentActive) {
      setActiveList(currentActive);
    }

    const queryPath = `shopping_lists/${activeListId}/items`;
    const q = query(
      collection(db, queryPath),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const result: ShoppingItem[] = [];
      snapshot.forEach((d) => {
        result.push({ itemId: d.id, ...d.data() } as ShoppingItem);
      });
      setItems(result);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, queryPath);
    });

    return () => unsubscribe();
  }, [activeListId, lists]);

  // Sync historical expense receipts of family
  useEffect(() => {
    if (!profile?.familyId) return;

    const queryPath = "expenses";
    const q = query(
      collection(db, queryPath),
      where("familyId", "==", profile.familyId),
      orderBy("spentAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const result: ExpenseRecord[] = [];
      snapshot.forEach((d) => {
        result.push({ expenseId: d.id, ...d.data() } as ExpenseRecord);
      });
      setExpenses(result);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, queryPath);
    });

    return () => unsubscribe();
  }, [profile?.familyId]);

  // Sync family members info to display profiles
  useEffect(() => {
    if (!profile?.familyId) return;

    const queryPath = "users";
    const q = query(
      collection(db, queryPath),
      where("familyId", "==", profile.familyId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const members: any[] = [];
      snapshot.forEach((d) => {
        members.push(d.data());
      });
      setFamilyMembers(members);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, queryPath);
    });

    return () => unsubscribe();
  }, [profile?.familyId]);

  const ensureUserProfile = async (currentUser: any) => {
    const userRef = doc(db, "users", currentUser.uid);
    let userSnap;
    try {
      userSnap = await getDoc(userRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${currentUser.uid}`);
      return;
    }

    if (!userSnap.exists()) {
      const newProf: UserProfile = {
        userId: currentUser.uid,
        displayName: currentUser.displayName || "Membro da Família",
        email: currentUser.email || "",
        photoURL: currentUser.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&fit=crop",
        familyId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      try {
        await setDoc(userRef, newProf);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}`);
      }
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Login failed:", err);
    }
  };

  const logActivity = async (message: string) => {
    if (!profile?.familyId || !profile) return;
    const path = "activities";
    const newActId = "act_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    try {
      await setDoc(doc(db, path, newActId), {
        activityId: newActId,
        familyId: profile.familyId,
        userId: profile.userId,
        userName: profile.displayName,
        userPhoto: profile.photoURL,
        message,
        createdAt: new Date(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `${path}/${newActId}`);
    }
  };

  const handleCreateFamily = async () => {
    if (!newFamilyName.trim() || !user) return;
    const token = "FAM-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    
    try {
      const famRef = doc(db, "families", token);
      const newFam: Family = {
        familyId: token,
        name: newFamilyName,
        createdBy: user.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await setDoc(famRef, newFam);

      // Link current user's profile to this family ID
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { familyId: token, updatedAt: new Date() });
      
      setNewFamilyName("");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `families/${token}`);
    }
  };

  const handleJoinFamily = async () => {
    if (!familyInputToken.trim() || !user) return;
    const token = familyInputToken.trim().toUpperCase();

    try {
      const famRef = doc(db, "families", token);
      const famSnap = await getDoc(famRef);
      if (!famSnap.exists()) {
        alert("Código de Família inválido. Por favor, confirme o token digitado.");
        return;
      }

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { familyId: token, updatedAt: new Date() });
      
      setFamilyInputToken("");
      await logActivity("entrou no grupo familiar!");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const handleLeaveFamily = async () => {
    if (!user || !profile?.familyId) return;
    const token = profile.familyId;
    if (confirm("Tem certeza que deseja sair deste grupo familiar? Suas listas serão guardadas no grupo.")) {
      try {
        await logActivity("deixou o grupo familiar.");
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { familyId: null, updatedAt: new Date() });
        setFamily(null);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      }
    }
  };

  const handleCreateList = async () => {
    if (!newListName.trim() || !profile?.familyId) return;
    const listId = "list_" + Date.now();
    const newList: ShoppingList = {
      listId,
      title: newListName.trim(),
      familyId: profile.familyId,
      createdBy: profile.userId,
      itemsCount: 0,
      checkedItemsCount: 0,
      totalEstBudget: 0,
      scannedFromNF: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      await setDoc(doc(db, "shopping_lists", listId), newList);
      await logActivity(`criou a lista de compras "${newListName.trim()}"`);
      setNewListName("");
      setActiveListId(listId);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "shopping_lists");
    }
  };

  const handleDeleteList = async (targetId: string, name: string) => {
    if (!confirm(`Deseja remover para sempre a lista "${name}" e todos os itens dela?`)) return;
    try {
      await deleteDoc(doc(db, "shopping_lists", targetId));
      await logActivity(`excluiu a lista "${name}"`);
      if (activeListId === targetId) {
        setActiveListId(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "shopping_lists");
    }
  };

  const handleAddItem = async () => {
    if (!itemName.trim() || !activeListId) return;
    const itemId = "item_" + Date.now();
    const parsedPrice = parseFloat(itemPrice) || 0;

    const newItem: ShoppingItem = {
      itemId,
      name: itemName.trim(),
      quantity: Math.max(itemQty, 1),
      category: itemCat,
      estimatedPrice: parsedPrice,
      checked: false,
      checkedBy: null,
      checkedAt: null,
      addedBy: profile?.userId || "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      await setDoc(doc(db, `shopping_lists/${activeListId}/items`, itemId), newItem);
      
      // Update shopping list aggregates
      const listRef = doc(db, "shopping_lists", activeListId);
      const updatedCount = items.length + 1;
      const originalChecked = items.filter(i => i.checked).length;
      const additionalBudget = parsedPrice * Math.max(itemQty, 1);
      const newBudget = (activeList?.totalEstBudget || 0) + additionalBudget;

      await updateDoc(listRef, {
        itemsCount: updatedCount,
        totalEstBudget: newBudget,
        updatedAt: new Date()
      });

      await logActivity(`adicionou o produto "${itemName.trim()}" (${itemQty}x) à lista`);

      setItemName("");
      setItemQty(1);
      setItemPrice("");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `shopping_lists/${activeListId}/items`);
    }
  };

  const handleToggleCheck = async (item: ShoppingItem) => {
    if (!activeListId || !profile) return;
    const itemRef = doc(db, `shopping_lists/${activeListId}/items`, item.itemId);
    const listRef = doc(db, "shopping_lists", activeListId);

    const nowChecked = !item.checked;
    const productCost = item.estimatedPrice * item.quantity;

    try {
      await updateDoc(itemRef, {
        checked: nowChecked,
        checkedBy: nowChecked ? profile.userId : null,
        checkedAt: nowChecked ? new Date() : null,
        updatedAt: new Date()
      });

      const currentlyCheckedCount = items.filter(i => i.checked).length;
      const newCheckedCount = nowChecked ? currentlyCheckedCount + 1 : currentlyCheckedCount - 1;

      await updateDoc(listRef, {
        checkedItemsCount: Math.max(0, newCheckedCount),
        updatedAt: new Date()
      });

      if (nowChecked) {
        await logActivity(`pegou no mercado e marcou o item "${item.name}"`);
      } else {
        await logActivity(`desmarcou o item "${item.name}" do carrinho`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shopping_lists/${activeListId}/items`);
    }
  };

  const handleDeleteItem = async (item: ShoppingItem) => {
    if (!activeListId) return;
    const itemRef = doc(db, `shopping_lists/${activeListId}/items`, item.itemId);
    const listRef = doc(db, "shopping_lists", activeListId);
    const productCost = item.estimatedPrice * item.quantity;

    try {
      await deleteDoc(itemRef);

      const newCount = Math.max(0, items.length - 1);
      const newChecked = item.checked ? Math.max(0, items.filter(i => i.checked).length - 1) : items.filter(i => i.checked).length;
      const newBudget = Math.max(0, (activeList?.totalEstBudget || 0) - productCost);

      await updateDoc(listRef, {
        itemsCount: newCount,
        checkedItemsCount: newChecked,
        totalEstBudget: newBudget,
        updatedAt: new Date()
      });

      await logActivity(`removeu o item "${item.name}" da lista`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `shopping_lists/${activeListId}/items`);
    }
  };

  // Import multiple products from NF scan
  const handleImportScannedItems = async (scannedItems: any[]) => {
    if (!activeListId || !profile) return;
    const listRef = doc(db, "shopping_lists", activeListId);
    
    try {
      const batch = writeBatch(db);
      let calculatedExtraBudget = 0;

      scannedItems.forEach((scanned) => {
        const itemId = "item_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
        const itemRef = doc(db, `shopping_lists/${activeListId}/items`, itemId);
        const estPrice = scanned.estimatedPrice || 0;
        calculatedExtraBudget += estPrice * scanned.quantity;

        const newItem: ShoppingItem = {
          itemId,
          name: scanned.name,
          quantity: scanned.quantity,
          category: scanned.category || "Mercearia",
          estimatedPrice: estPrice,
          checked: false,
          checkedBy: null,
          checkedAt: null,
          addedBy: profile.userId,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        batch.set(itemRef, newItem);
      });

      await batch.commit();

      const newBudget = (activeList?.totalEstBudget || 0) + calculatedExtraBudget;
      const newCount = items.length + scannedItems.length;

      await updateDoc(listRef, {
        itemsCount: newCount,
        totalEstBudget: newBudget,
        scannedFromNF: true,
        updatedAt: new Date()
      });

      await logActivity(`escanou a Nota Fiscal e adicionou ${scannedItems.length} novos itens ao carrinho de compras!`);
    } catch (error) {
      console.error("Batch insert failed:", error);
    }
  };

  // Complete checkout purchase to register actual expenses
  const handleFinalizeCheckout = async () => {
    const finalVal = parseFloat(finalInvoiceAmount) || 0;
    if (finalVal <= 0 || !profile?.familyId || !activeListId || !activeList) return;

    try {
      const expenseId = "exp_" + Date.now();
      const expenseRef = doc(db, "expenses", expenseId);
      
      const newExpense: ExpenseRecord = {
        expenseId,
        listId: activeListId,
        familyId: profile.familyId,
        shopperId: profile.userId,
        shopperName: profile.displayName,
        spentAt: new Date(),
        totalSpent: finalVal,
        itemsCount: items.filter(i => i.checked).length || items.length,
        createdAt: new Date()
      };

      await setDoc(expenseRef, newExpense);

      // Create activity message for family
      await logActivity(`finalizou a ida ao supermercado para a lista "${activeList.title}" gastando o valor final de R$ ${finalVal.toFixed(2)}!`);

      // Wipe out / clear checked items to reset lists state
      const batch = writeBatch(db);
      const checkedIts = items.filter(i => i.checked);
      checkedIts.forEach((it) => {
        const itemRef = doc(db, `shopping_lists/${activeListId}/items`, it.itemId);
        batch.delete(itemRef);
      });
      await batch.commit();

      const listRef = doc(db, "shopping_lists", activeListId);
      await updateDoc(listRef, {
        itemsCount: Math.max(0, items.length - checkedIts.length),
        checkedItemsCount: 0,
        totalEstBudget: Math.max(0, (activeList.totalEstBudget || 0) - checkedIts.reduce((acc, c) => acc + (c.estimatedPrice * c.quantity), 0)),
        updatedAt: new Date()
      });

      setCheckoutModalOpen(false);
      setFinalInvoiceAmount("");
      // Take user to Spend Reports to immediately see the awesome charts update!
      setActiveTab("report");
    } catch (error) {
      console.error("Checkout failed:", error);
    }
  };

  // Filter items by selected Category Tag
  const filteredItems = activeCategoryFilter === "Tudo" 
    ? items 
    : items.filter(i => i.category === activeCategoryFilter);

  // Group items by category to display clean dividers
  const groupedItemsMap: { [cat: string]: ShoppingItem[] } = {};
  filteredItems.forEach((x) => {
    if (!groupedItemsMap[x.category]) {
      groupedItemsMap[x.category] = [];
    }
    groupedItemsMap[x.category].push(x);
  });

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600 animate-spin">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <p className="text-sm font-semibold text-slate-600">Acessando banco de dados...</p>
        </div>
      </div>
    );
  }

  // LOGOUT PAGE - Splash intro with Google Sign-In
  if (!user || !profile) {
    return (
      <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-5 flex flex-col justify-between p-8 sm:p-12 bg-white border-r border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600 border border-indigo-100">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <span className="font-display font-bold text-lg text-slate-800 tracking-tight">Comprafácil Co-op</span>
          </div>

          <div className="space-y-6 my-12">
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full">
                Sincronização Familiar em Tempo Real
              </span>
              <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-800 tracking-tight leading-tight">
                Organize sua lista de mercado em família
              </h1>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">
              Monitore itens simultaneamente com seu parceiro ou filhos direto nas prateleiras do mercado, compartilhe notas através de links, escaneie cupons fiscais com Inteligência Artificial e estime seu gasto antes da boca do caixa de forma segura.
            </p>

            <button
              onClick={handleGoogleLogin}
              className="w-full sm:w-auto py-3.5 px-6 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl text-sm transition-all hover:shadow-lg flex items-center justify-center gap-3 cursor-pointer"
            >
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.24 10.285V13.4h6.887c-.648 2.41-2.519 4.13-5.136 4.13A5.46 5.46 0 0 1 8.5 12c0-3.059 2.5-5.53 5.491-5.53 1.34 0 2.551.49 3.51 1.411l2.45-2.45C18.311 3.86 16.29 3 14 3 9.03 3 5 7.03 5 12s4.03 9 9 9c4.77 0 8.5-3.37 8.5-8.5 0-.585-.05-1.125-.16-1.5H12.24Z" />
              </svg>
              <span>Acessar com o Google</span>
            </button>
          </div>

          <p className="text-xs text-slate-400">
            Ao acessar, você concorda em armazenar suas informações de forma segura e colaborativa baseadas nas regras do Firebase Enterprise.
          </p>
        </div>

        <div className="hidden lg:col-span-7 bg-slate-100 lg:flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-indigo-50 to-indigo-100/30">
          <div className="absolute inset-0 opacity-45 bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:24px_24px]" />
          <div className="max-w-md w-full p-8 bg-white/40 backdrop-blur-md rounded-3xl border border-white/60 shadow-2xl relative z-10 m-4 space-y-4">
            <div className="flex gap-2 items-center text-xs font-semibold text-indigo-700 bg-white/85 w-fit px-2.5 py-1 rounded-full border border-indigo-50">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Prático & IA Grounded</span>
            </div>
            <div className="p-4 bg-white/90 rounded-2xl shadow-sm border border-slate-100 space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>CUPOM SCANNER</span>
                <span className="font-mono text-indigo-600">Conferido✓</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-slate-600">
                  <span>1. Leite Integral Un</span>
                  <span>R$ 4,80</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-600">
                  <span>2. Arroz Prato Fino 5kg</span>
                  <span>R$ 28,90</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-600">
                  <span>3. Azeite Extra Virgem</span>
                  <span>R$ 38,50</span>
                </div>
              </div>
              <div className="pt-2 border-t border-dashed border-slate-200 flex justify-between text-xs font-bold text-slate-800">
                <span>Total Estimado IA</span>
                <span>R$ 72,20</span>
              </div>
            </div>
            <h3 className="font-display font-bold text-slate-800">Confira as Nota Fiscais Escaneando Fotos</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              O leitor do sistema analisa em segundos fotos e textos de cupons fiscais brasileiros usando o Google Gemini, separando itens, preços sugeridos e economias planejadas de forma robusta e transparente.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // NO FAMILY SCREEN - Prompt join/creation flow
  if (!family) {
    return (
      <div className="min-h-screen flex flex-col justify-between py-6 px-4 max-w-lg mx-auto">
        <div className="flex items-center justify-between pb-6 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <span className="font-display font-bold text-sm text-slate-700">Comprafácil Co-op</span>
          </div>
          <button
            onClick={() => signOut(auth)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair</span>
          </button>
        </div>

        <div className="my-auto py-10 space-y-8">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-display font-bold text-slate-800">Conecte sua Família</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Para começar a gerenciar suas listas e compartilhar atualizações em tempo real, você precisa criar ou entrar em um grupo usando um Token.
            </p>
          </div>

          <div className="space-y-6">
            {/* Create form */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">Iniciar um Novo Grupo Familiar</h3>
              <p className="text-[11px] text-slate-400">Gere um novo código para disponibilizar a toda a sua família.</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nome do grupo (ex: Família Silva)"
                  value={newFamilyName}
                  onChange={(e) => setNewFamilyName(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none focus:bg-white"
                />
                <button
                  onClick={handleCreateFamily}
                  disabled={!newFamilyName.trim()}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Criar</span>
                </button>
              </div>
            </div>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-100"></div>
              <span className="flex-shrink mx-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">Ou</span>
              <div className="flex-grow border-t border-slate-100"></div>
            </div>

            {/* Join Form */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">Entrar em um Grupo Existente</h3>
              <p className="text-[11px] text-slate-400">Insira o código Token de 10 caracteres compartilhado.</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="ex: FAM-K7Y1XQ"
                  value={familyInputToken}
                  onChange={(e) => setFamilyInputToken(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-mono uppercase tracking-wider focus:ring-1 focus:ring-indigo-500 focus:outline-none focus:bg-white"
                />
                <button
                  onClick={handleJoinFamily}
                  disabled={!familyInputToken.trim()}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-40"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Interligar</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-6 border-t border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={profile.photoURL} className="w-7 h-7 rounded-full object-cover" />
            <div className="text-left">
              <p className="text-[10px] font-bold text-slate-700 leading-tight">{profile.displayName}</p>
              <p className="text-[9px] text-slate-400 leading-none">{profile.email}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // MAIN COLLABORATIVE WORKSPACE
  return (
    <div className="min-h-screen flex flex-col">
      {/* Dynamic Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600 border border-indigo-100">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-display font-extrabold text-base text-slate-800 tracking-tight leading-none">
                  Comprafácil Co-op
                </h1>
                <p className="text-[11px] text-slate-400 font-medium leading-none mt-1">
                  Família: <span className="font-semibold text-slate-600">{family.name}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Family Token display & copy badge */}
          <div className="flex items-center gap-3 flex-wrap">
            <div 
              onClick={() => {
                navigator.clipboard.writeText(family.familyId);
                alert(`Código copiado! Compartilhe o token "${family.familyId}" com familiares para eles acessarem em tempo real.`);
              }}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-2 text-xs font-mono font-bold text-slate-600 cursor-pointer shadow-sm transition-all"
              title="Clique para Copiar Código Familiar"
            >
              <Share2 className="w-3.5 h-3.5 text-indigo-600" />
              <span className="font-normal text-[10px] text-slate-400">Token Familiar:</span>
              <span className="text-slate-800">{family.familyId}</span>
            </div>

            {/* Avatar Stack */}
            <div className="flex -space-x-1.5 overflow-hidden">
              {familyMembers.map((member, i) => (
                <img
                  key={i}
                  className="inline-block h-6.5 w-6.5 rounded-full ring-2 ring-white object-cover"
                  src={member.photoURL}
                  title={member.displayName}
                  alt={member.displayName}
                />
              ))}
            </div>

            <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

            <button
              onClick={handleLeaveFamily}
              className="text-xs text-red-500 hover:text-red-700 font-semibold flex items-center gap-1 cursor-pointer"
              title="Deixar família"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Alterar Grupo</span>
            </button>

            <button
              onClick={() => signOut(auth)}
              className="p-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition"
              title="Desconectar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Workspace views Tab Selector Bar */}
        <div className="max-w-7xl mx-auto px-4 flex gap-6 text-sm border-t border-slate-50">
          <button
            onClick={() => setActiveTab("lists")}
            className={`py-3 font-semibold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === "lists" 
                ? "border-indigo-600 text-indigo-700" 
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <ListTodo className="w-4 h-4" />
            <span>Listas Compartilhadas</span>
          </button>
          <button
            onClick={() => setActiveTab("report")}
            className={`py-3 font-semibold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === "report" 
                ? "border-indigo-600 text-indigo-700" 
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Relatórios & Hábitos por IA</span>
          </button>
        </div>
      </header>

      {/* Main Container Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Real-time push notification banners tracker wrapper */}
        <AlertNotificationCenter familyId={profile?.familyId} currentUserId={profile?.userId || ""} />

        {activeTab === "lists" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* List Selection Left Column */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Nossas Listas</h3>
                </div>

                {/* List Creator */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ex: Rancho Mensal, Churrasco..."
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none focus:bg-white placeholder-slate-400"
                  />
                  <button
                    onClick={handleCreateList}
                    disabled={!newListName.trim()}
                    className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl cursor-pointer disabled:opacity-40 transition-colors"
                    title="Adicionar nova lista"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {lists.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">Nenhuma lista ativa criada no grupo familiares.</p>
                ) : (
                  <div className="space-y-1.5 max-h-72 overflow-y-auto">
                    {lists.map((list) => {
                      const isSelected = list.listId === activeListId;
                      const checkPercent = list.itemsCount > 0 
                        ? Math.round((list.checkedItemsCount / list.itemsCount) * 100) 
                        : 0;

                      return (
                        <div
                          key={list.listId}
                          onClick={() => setActiveListId(list.listId)}
                          className={`group w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected 
                              ? "bg-indigo-50/50 border-indigo-300 text-slate-800"
                              : "bg-white border-slate-100 hover:border-slate-200 text-slate-500"
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-xs font-bold text-slate-800 truncate">{list.title}</span>
                            <button
                              onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteList(list.listId, list.title);
                                }}
                              className="text-slate-300 hover:text-red-500 opacity-30 group-hover:opacity-100 transition duration-150 p-0.5 rounded cursor-pointer"
                              title="Excluir lista"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Mini checklist progress metrics */}
                          <div className="mt-3 space-y-1.5">
                            <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                              <span>{list.checkedItemsCount} de {list.itemsCount} do carrinho</span>
                              <span className="font-mono">{checkPercent}%</span>
                            </div>
                            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-indigo-600 transition-all duration-300"
                                style={{ width: `${checkPercent}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              {/* NF Instant OCR photo scanning */}
              {activeList && (
                <NFScanner 
                  onAddItemsToList={handleImportScannedItems} 
                  listTitle={activeList.title} 
                />
              )}
            </div>

            {/* List Details and Items Right Column */}
            <div className="lg:col-span-8 space-y-5">
              {!activeList ? (
                <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-100 p-12 text-center text-slate-400 shadow-sm flex flex-col items-center justify-center gap-1.5">
                  <ShoppingCart className="w-10 h-10 text-slate-200" />
                  <p className="font-semibold text-slate-600">Nenhuma lista de mercado selecionada</p>
                  <p className="text-xs">Crie ou clique sobre uma lista na barra lateral para começar a ticar seus produtos compartilhadamente.</p>
                </div>
              ) : (
                <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-100 p-6 shadow-sm space-y-6">
                  
                  {/* Active List Headers */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-600 font-mono">Lista de compras ativa</span>
                      <h2 className="text-xl font-display font-extrabold text-slate-800">{activeList.title}</h2>
                      {activeList.scannedFromNF && (
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-indigo-600 font-semibold bg-indigo-50 w-fit px-1.5 py-0.5 rounded">
                          <Sparkles className="w-3 h-3" />
                          <span>Adicionado via digitalização de Cupom Fiscal com IA</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] text-slate-400 block font-medium uppercase">Estimativa de Gasto</span>
                        <span className="text-lg font-bold font-mono text-slate-800 text-right" title="Soma estimada de preços opcionais inseridos no carrinho.">
                          R$ {activeList.totalEstBudget.toFixed(2)}
                        </span>
                      </div>

                      {items.length > 0 && (
                        <button
                          onClick={() => {
                            setFinalInvoiceAmount(activeList.totalEstBudget.toFixed(2));
                            setCheckoutModalOpen(true);
                          }}
                          className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-indigo-100"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Finalizar Compra</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Add Product Manual Form */}
                  <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-200">
                    <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                      <p className="text-xs font-bold text-slate-600 block uppercase tracking-wider">Adicionar item manualmente</p>
                      <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded">Apenas o nome é obrigatório • Preço é opcional (estimado)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-4">
                        <input
                          type="text"
                          placeholder="Arroz, Batata, Papel..."
                          value={itemName}
                          onChange={(e) => setItemName(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                      
                      <div className="sm:col-span-2">
                        <input
                          type="number"
                          placeholder="Qtd"
                          min="1"
                          value={itemQty}
                          onChange={(e) => setItemQty(parseInt(e.target.value) || 1)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <select
                          value={itemCat}
                          onChange={(e) => setItemCat(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-600 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        >
                          {categories.map((cat, i) => (
                            <option key={i} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          placeholder="Est. R$ (Opcional)"
                          value={itemPrice}
                          onChange={(e) => setItemPrice(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-1">
                        <button
                          onClick={handleAddItem}
                          disabled={!itemName.trim()}
                          className="w-full py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:shadow-md text-white font-bold rounded-xl text-xs flex justify-center items-center h-full cursor-pointer disabled:opacity-40 transition-all"
                          title="Inserir produto"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Category Filter Pills */}
                  {items.length > 0 && (
                    <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
                      {["Tudo", ...categories].map((cat, idx) => {
                        const isFiltered = cat === activeCategoryFilter;
                        // Count occurrences of category
                        const cnt = cat === "Tudo" ? items.length : items.filter(i => i.category === cat).length;
                        if (cnt === 0 && cat !== "Tudo") return null;

                        return (
                          <button
                            key={idx}
                            onClick={() => setActiveCategoryFilter(cat)}
                            className={`px-3 py-1.5 rounded-full transition-all border whitespace-nowrap cursor-pointer ${
                              isFiltered 
                                ? "bg-slate-900 border-slate-900 text-white font-semibold"
                                : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-500"
                            }`}
                          >
                            <span>{cat}</span>
                            <span className="ml-1 opacity-70 font-mono text-[10px]">({cnt})</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Real-time Checklist products render */}
                  {items.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-slate-100 rounded-xl bg-slate-50/20">
                      <ShoppingCart className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                      <p className="text-xs text-slate-500 font-semibold">Esta lista está vazia</p>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-sm mx-auto">
                        Adicione produtos de mercado digitando acima manualmente ou use um cupom fiscal no painel de scanner à esquerda para carregar itens com Inteligência Artificial!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {Object.keys(groupedItemsMap).map((catName) => (
                        <div key={catName} className="space-y-2">
                          <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span>
                            <span>{catName}</span>
                          </h4>

                          <div className="space-y-1.5">
                            {groupedItemsMap[catName].map((item) => (
                              <div
                                key={item.itemId}
                                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                  item.checked 
                                    ? "bg-slate-50/70 border-slate-100 opacity-60 line-through text-slate-400" 
                                    : "bg-white hover:bg-slate-50/30 border-slate-100 text-slate-700"
                                }`}
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  {/* Checkbox trigger */}
                                  <button
                                    onClick={() => handleToggleCheck(item)}
                                    className={`w-5 h-5 rounded-md border flex items-center justify-center cursor-pointer transition-all ${
                                      item.checked 
                                        ? "bg-indigo-600 border-indigo-600 text-white" 
                                        : "border-slate-300 hover:border-indigo-500 bg-white"
                                    }`}
                                  >
                                    {item.checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                  </button>

                                  <div className="text-left truncate">
                                    <p className="text-xs font-bold">{item.name}</p>
                                    <p className="text-[9px] text-slate-400">
                                      Qtd: <span className="font-bold">{item.quantity}</span>
                                      {item.estimatedPrice > 0 && ` • Un: R$ ${item.estimatedPrice.toFixed(2)}`}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-3">
                                  {item.estimatedPrice > 0 && (
                                    <span className="text-xs font-mono font-bold text-slate-500">
                                      R$ {(item.estimatedPrice * item.quantity).toFixed(2)}
                                    </span>
                                  )}
                                  
                                  <button
                                    onClick={() => handleDeleteItem(item)}
                                    className="p-1 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded transition cursor-pointer"
                                    title="Remover item"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Interactive Quick Advice Footer */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span>💡 Seu progresso salva em tempo real no servidor para todos os celulares da família.</span>
                    <span>{items.filter(i => i.checked).length} no carrinho</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* HABITS prediction reports subview */
          <SpendHabitsReport 
            expenses={expenses} 
            currentListItems={items} 
            familyId={profile?.familyId || ""} 
          />
        )}
      </main>

      {/* Checkout Finalize Session Modal Overlay */}
      {checkoutModalOpen && activeList && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div 
            className="bg-white rounded-2xl border border-slate-100 p-6 max-w-sm w-full space-y-4 shadow-xl"
            style={{ animation: "scaleUp 0.15s ease-out-back" }}
          >
            <div className="flex justify-between items-center">
              <h3 className="text-base font-semibold text-slate-800">Finalizar Ida ao Mercado</h3>
              <button 
                onClick={() => setCheckoutModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-normal">
              Finalizar esta lista esvaziará o carrinho de compras (itens marcados) e salvará os valores no histórico para que a Inteligência Artificial melhore suas previsões de consumo familiar mensal.
            </p>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Valor Total do Cupom de Caixa (R$)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400 font-mono">R$</span>
                <input
                  type="text"
                  placeholder="ex: 78.50"
                  value={finalInvoiceAmount}
                  onChange={(e) => setFinalInvoiceAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs font-mono font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none focus:bg-white"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setCheckoutModalOpen(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition duration-150"
              >
                Voltar
              </button>
              <button
                onClick={handleFinalizeCheckout}
                disabled={!finalInvoiceAmount.trim() || parseFloat(finalInvoiceAmount) <= 0}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs transition duration-150 disabled:opacity-40 shadow-sm"
              >
                Concluir & Zerar Carrinho
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
