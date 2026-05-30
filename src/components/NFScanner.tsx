import React, { useState, useRef } from "react";
import { FileText, UploadCloud, Sparkles, Check, Loader2, Camera, AlertCircle, Plus, Clipboard } from "lucide-react";

interface ScannedItem {
  name: string;
  quantity: number;
  category: string;
  estimatedPrice?: number;
}

interface NFScannerProps {
  onAddItemsToList: (items: ScannedItem[]) => void;
  listTitle: string;
}

export default function NFScanner({ onAddItemsToList, listTitle }: NFScannerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [totalAmount, setTotalAmount] = useState<number | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("image/jpeg");
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    setMimeType(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    setError(null);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleScan = async () => {
    if (!imagePreview && !pastedText.trim()) {
      setError("Por favor, tire uma foto da Nota Fiscal ou cole o texto do cupom.");
      return;
    }

    setLoading(true);
    setError(null);
    setScannedItems([]);

    try {
      let base64Data = null;
      if (imagePreview) {
        // Strip out the data:image/...;base64, header prefix for Gemini content transmission
        const split = imagePreview.split(",");
        if (split.length > 1) {
          base64Data = split[1];
        }
      }

      const response = await fetch("/api/gemini/scan-nf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: pastedText || null,
          base64Image: base64Data,
          mimeType,
        }),
      });

      if (!response.ok) {
        const errPayload = await response.json();
        throw new Error(errPayload.error || "Erro de rede ao escanear");
      }

      const data = await response.json();
      if (data.items && Array.isArray(data.items)) {
        setScannedItems(data.items);
        if (data.totalAmount) {
          setTotalAmount(data.totalAmount);
        }
      } else {
        throw new Error("Formato inválido retornado pela IA. Tente novamente.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ocorreu um erro ao processar. Certifique-se de configurar a chave GEMINI_API_KEY no menu Settings.");
    } finally {
      setLoading(false);
    }
  };

  const transferItems = () => {
    if (scannedItems.length === 0) return;
    onAddItemsToList(scannedItems);
    // Reset scanner state on success
    setScannedItems([]);
    setImagePreview(null);
    setPastedText("");
    setTotalAmount(null);
  };

  return (
    <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-indigo-100 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
          <Sparkles className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Escanear Nota Fiscal por IA</h3>
          <p className="text-xs text-slate-500">Adicione itens comprados ou listas inteiras instantaneamente</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        {/* Image upload / file drop zone */}
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all h-44 relative bg-slate-50/50 ${
            dragActive ? "border-indigo-500 bg-indigo-50/50" : "border-slate-200 hover:border-slate-300"
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
          />
          {imagePreview ? (
            <div className="absolute inset-0 p-2 flex flex-col items-center">
              <img
                src={imagePreview}
                alt="Cupom"
                className="w-full h-full object-contain rounded-lg filter drop-shadow"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setImagePreview(null);
                }}
                className="absolute top-4 right-4 bg-red-500 text-white text-xs px-2 py-1 rounded hover:bg-red-600"
              >
                Limpar
              </button>
            </div>
          ) : (
            <div className="text-center">
              <div className="mx-auto w-12 h-12 bg-white rounded-full flex items-center justify-center border border-slate-100 mb-2 shadow-sm text-slate-400">
                <Camera className="w-5 h-5 text-indigo-600" />
              </div>
              <p className="text-sm font-medium text-slate-700">Tire foto ou Envie Imagem</p>
              <p className="text-xs text-slate-400 mt-1">Solte sua foto aqui do celular ou computador</p>
            </div>
          )}
        </div>

        {/* Text Area backup container */}
        <div className="flex flex-col h-44 bg-slate-50/50 rounded-xl p-3 border border-slate-200 relative">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-2">
            <Clipboard className="w-3.5 h-3.5" />
            <span>Ou cole dados textuais do cupom (SAT/NFCe)</span>
          </div>
          <textarea
            value={pastedText}
            onChange={(e) => {
              setPastedText(e.target.value);
              // reset image preview if they are typing instead to avoid confusion
              if (e.target.value && imagePreview) setImagePreview(null);
            }}
            placeholder="Cole o código de barras, links da receita ou conteúdo parcial de texto copiado para escanear..."
            className="w-full flex-1 bg-transparent resize-none text-xs text-slate-700 focus:outline-none placeholder-slate-400 font-mono"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-100 text-red-600 text-xs rounded-lg p-3 flex gap-2 items-center">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {scannedItems.length === 0 ? (
        <button
          onClick={handleScan}
          disabled={loading || (!imagePreview && !pastedText.trim())}
          className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-medium rounded-xl hover:shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none text-sm cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>A Inteligência Artificial está lendo o cupom...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Analisar Nota Fiscal & Encontrar Itens</span>
            </>
          )}
        </button>
      ) : (
        <div className="border border-slate-100 rounded-xl bg-slate-50/50 p-4">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <div className="text-xs font-semibold text-slate-600">
              Produtos encontrados ({scannedItems.length})
            </div>
            {totalAmount && (
              <div className="text-xs font-bold text-indigo-600">
                Total da Nota: R$ {totalAmount.toFixed(2)}
              </div>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 text-xs">
            {scannedItems.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-100">
                <div className="flex items-center gap-1.5 font-medium text-slate-800">
                  <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                    {item.quantity}x
                  </span>
                  <span>{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {item.category && (
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-semibold">
                      {item.category}
                    </span>
                  )}
                  {item.estimatedPrice && (
                    <span className="text-slate-500 font-mono">
                      R$ {item.estimatedPrice.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setScannedItems([])}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-xs"
            >
              Cancelar
            </button>
            <button
              onClick={transferItems}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-xs flex items-center justify-center gap-1 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Importar {scannedItems.length} Itens para "{listTitle}"</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
