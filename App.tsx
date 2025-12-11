import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Scissors, 
  Users, 
  Plus, 
  Search, 
  CheckCircle2, 
  Shirt,
  Tags,
  Trash2,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  Edit2,
  PackageCheck,
  ClipboardList,
  Archive,
  CalendarDays,
  TrendingUp,
  AlertCircle,
  Trophy,
  FileText,
  Filter,
  MapPin,
  Clock,
  Activity,
  StickyNote,
  Loader2,
  Scroll,
  Printer,
  Layers,
  Palette,
  PlusCircle,
  Calendar
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

import { supabase } from './lib/supabaseClient';
import { StatCard } from './components/StatCard';
import { OrderModal } from './components/OrderModal';
import { ProductModal } from './components/ProductModal';
import { CutConfirmationModal } from './components/CutConfirmationModal';
import { DistributeModal } from './components/DistributeModal';
import { SeamstressModal } from './components/SeamstressModal';
import { FabricModal } from './components/FabricModal';
import { generateProductionInsights } from './services/geminiService';
import { ProductionOrder, Seamstress, OrderStatus, ProductReference, SizeDistribution, ProductionOrderItem, OrderSplit, Fabric } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'production' | 'seamstresses' | 'products' | 'reports' | 'fabrics'>('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  
  // Production Sub-tabs state
  const [productionStage, setProductionStage] = useState<OrderStatus>(OrderStatus.PLANNED);

  // Data State
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [seamstresses, setSeamstresses] = useState<Seamstress[]>([]);
  const [references, setReferences] = useState<ProductReference[]>([]);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  
  // UI State for Modals
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isSeamstressModalOpen, setIsSeamstressModalOpen] = useState(false);
  const [isFabricModalOpen, setIsFabricModalOpen] = useState(false);
  
  const [expandedOrders, setExpandedOrders] = useState<string[]>([]);
  
  // Logic State for Modals
  const [cuttingOrder, setCuttingOrder] = useState<ProductionOrder | null>(null);
  const [distributingOrder, setDistributingOrder] = useState<ProductionOrder | null>(null);
  const [editingProduct, setEditingProduct] = useState<ProductReference | null>(null);
  const [orderToEdit, setOrderToEdit] = useState<ProductionOrder | null>(null);
  const [seamstressToEdit, setSeamstressToEdit] = useState<Seamstress | null>(null);
  const [fabricToEdit, setFabricToEdit] = useState<Fabric | null>(null);
  
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Report Filters State
  const [reportFilters, setReportFilters] = useState({
      startDate: '',
      endDate: '',
      seamstressId: '',
      status: '',
      reference: '',
      fabric: ''
  });

  // Fabric Filters
  const [fabricFilters, setFabricFilters] = useState({
    name: '',
    color: '',
    minStock: ''
  });

  // --- INITIAL FETCH ---
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: productsData } = await supabase.from('products').select('*');
      const { data: seamstressesData } = await supabase.from('seamstresses').select('*');
      const { data: ordersData } = await supabase.from('orders').select('*').order('createdAt', { ascending: false });
      const { data: fabricsData } = await supabase.from('fabrics').select('*').order('name', { ascending: true });

      if (productsData) setReferences(productsData);
      if (seamstressesData) setSeamstresses(seamstressesData);
      if (ordersData) setOrders(ordersData);
      if (fabricsData) setFabrics(fabricsData);
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Erro ao carregar dados do sistema.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- LOGIC: SEQUENTIAL ID ---
  const nextOrderId = useMemo(() => {
    // Filter only numeric IDs to find the max
    const ids = orders.map(o => parseInt(o.id)).filter(n => !isNaN(n));
    if (ids.length === 0) return '1';
    return (Math.max(...ids) + 1).toString();
  }, [orders]);

  // --- UNIQUE FABRICS LIST ---
  const uniqueFabrics = useMemo(() => {
    const fabrics = references.map(r => r.defaultFabric).filter(f => f && f.trim() !== '');
    return Array.from(new Set(fabrics)).sort();
  }, [references]);

  // --- DASHBOARD CALCULATIONS ---

  const dashboardMetrics = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // 1. General Stats
    const totalOrders = orders.length;
    const plannedOrdersCount = orders.filter(o => o.status === OrderStatus.PLANNED).length;
    const cuttingOrders = orders.filter(o => o.status === OrderStatus.CUTTING).length;
    const sewingPackets = orders.reduce((acc, o) => acc + (o.splits ? o.splits.filter(s => s.status === OrderStatus.SEWING).length : 0), 0);
    
    // Active Seamstresses (Count of distinct seamstresses with active splits)
    const activeSeamstressesCount = new Set(
        orders.flatMap(o => (o.splits || []).filter(s => s.status === OrderStatus.SEWING).map(s => s.seamstressId))
    ).size;

    // 2. Production Pieces (Total vs Month)
    let totalPiecesProduced = 0;
    let monthPiecesProduced = 0;

    orders.forEach(order => {
        (order.splits || []).forEach(split => {
            if (split.status === OrderStatus.FINISHED) {
                const pieces = split.items.reduce((acc, i) => acc + i.actualPieces, 0);
                totalPiecesProduced += pieces;

                if (split.finishedAt) {
                    const finishedDate = new Date(split.finishedAt);
                    if (finishedDate.getMonth() === currentMonth && finishedDate.getFullYear() === currentYear) {
                        monthPiecesProduced += pieces;
                    }
                }
            }
        });
    });

    // 3. Seamstress Productivity (Ranking) & Idle Check
    const seamstressStats = seamstresses.map(s => {
        let produced = 0;
        let activePackets = 0;

        orders.forEach(o => {
            (o.splits || []).forEach(split => {
                if (split.seamstressId === s.id) {
                    if (split.status === OrderStatus.FINISHED) {
                        produced += split.items.reduce((acc, i) => acc + i.actualPieces, 0);
                    } else if (split.status === OrderStatus.SEWING) {
                        activePackets++;
                    }
                }
            });
        });

        return {
            ...s,
            produced,
            activePackets,
            isIdle: s.active && activePackets === 0
        };
    }).sort((a, b) => b.produced - a.produced);

    // 4. Chart Data: Weekly
    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayKey = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        
        let value = 0;
        orders.forEach(o => {
            (o.splits || []).forEach(s => {
                if (s.status === OrderStatus.FINISHED && s.finishedAt) {
                    const fDate = new Date(s.finishedAt);
                    if (fDate.toDateString() === d.toDateString()) {
                        value += s.items.reduce((acc, item) => acc + item.actualPieces, 0);
                    }
                }
            });
        });
        weeklyData.push({ name: dayKey, peças: value });
    }

    // 5. Chart Data: Monthly
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthKey = d.toLocaleDateString('pt-BR', { month: 'short' });
        const mIdx = d.getMonth();
        const yIdx = d.getFullYear();

        let value = 0;
        orders.forEach(o => {
            (o.splits || []).forEach(s => {
                if (s.status === OrderStatus.FINISHED && s.finishedAt) {
                    const fDate = new Date(s.finishedAt);
                    if (fDate.getMonth() === mIdx && fDate.getFullYear() === yIdx) {
                        value += s.items.reduce((acc, item) => acc + item.actualPieces, 0);
                    }
                }
            });
        });
        monthlyData.push({ name: monthKey, peças: value });
    }

    return {
        totalOrders,
        cuttingOrders,
        sewingPackets,
        plannedOrdersCount,
        activeSeamstressesCount,
        totalPiecesProduced,
        monthPiecesProduced,
        seamstressStats,
        weeklyData,
        monthlyData,
        idleSeamstresses: seamstressStats.filter(s => s.isIdle),
        activeSeamstressesList: seamstressStats.filter(s => !s.isIdle && s.activePackets > 0)
    };
  }, [orders, seamstresses]);

  // Counts for tabs
  const stageCounts = useMemo(() => {
      return {
          [OrderStatus.PLANNED]: orders.filter(o => o.status === OrderStatus.PLANNED).length,
          [OrderStatus.CUTTING]: orders.filter(o => o.status === OrderStatus.CUTTING).length,
          [OrderStatus.SEWING]: orders.filter(o => o.status === OrderStatus.SEWING).length,
          [OrderStatus.FINISHED]: orders.filter(o => o.status === OrderStatus.FINISHED).length,
      }
  }, [orders]);

  // --- HANDLERS ---

  const handleCreateOrder = async (newOrderData: Omit<ProductionOrder, 'updatedAt'>) => {
    try {
        const existingIndex = orders.findIndex(o => o.id === newOrderData.id);
        const timestamp = new Date().toISOString();

        if (existingIndex > -1) {
            // Edit
            const { error } = await supabase
                .from('orders')
                .update({ ...newOrderData, updatedAt: timestamp })
                .eq('id', newOrderData.id);
            
            if (error) throw error;
            
            setOrders(prev => prev.map(o => o.id === newOrderData.id ? { ...newOrderData, updatedAt: timestamp } : o));
        } else {
            // Create
            const { error } = await supabase
                .from('orders')
                .insert([{ ...newOrderData, updatedAt: timestamp }]);
            
            if (error) throw error;

            setOrders(prev => [{ ...newOrderData, updatedAt: timestamp }, ...prev]);
        }
    } catch (error) {
        console.error("Error saving order:", error);
        alert("Erro ao salvar pedido no banco de dados.");
    }
  };

  const handleEditOrder = (order: ProductionOrder) => {
      setOrderToEdit(order);
      setIsOrderModalOpen(true);
  };

  const handleDeleteOrder = async (id: string) => {
      if (window.confirm("Tem certeza que deseja excluir esta ordem?")) {
          try {
              const { error } = await supabase.from('orders').delete().eq('id', id);
              if (error) throw error;
              setOrders(orders.filter(o => o.id !== id));
          } catch (error) {
              console.error("Error deleting order:", error);
              alert("Erro ao excluir pedido.");
          }
      }
  };

  const handleDeleteProduct = async (id: string) => {
    if (window.confirm("Tem certeza que deseja excluir este produto?")) {
        try {
            const { error } = await supabase.from('products').delete().eq('id', id);
            if (error) throw error;
            setReferences(prev => prev.filter(r => r.id !== id));
        } catch (error) {
            console.error("Error deleting product:", error);
            alert("Erro ao excluir produto.");
        }
    }
  };

  const handleSaveProduct = async (product: Omit<ProductReference, 'id'> | ProductReference) => {
    try {
        // Ensure numeric fields are correctly formatted or null if not present
        const payload = {
            ...product,
            estimatedPiecesPerRoll: product.estimatedPiecesPerRoll ? Number(product.estimatedPiecesPerRoll) : null
        };

        let savedProduct: ProductReference;
        
        if ('id' in product) {
            // Update
            const { error } = await supabase.from('products').update(payload).eq('id', product.id);
            
            if (error) {
                // FALLBACK: If column 'estimatedPiecesPerRoll' missing, try saving without it
                if (error.code === '42703') { // 42703 is Undefined Column
                     console.warn("Column missing, retrying without estimatedPiecesPerRoll");
                     const { estimatedPiecesPerRoll, ...safePayload } = payload;
                     const { error: retryError } = await supabase.from('products').update(safePayload).eq('id', product.id);
                     if (retryError) throw retryError;
                     
                     alert("Produto salvo, mas o campo 'Estimativa Peças/Rolo' não foi gravado pois a coluna não existe no banco de dados.");
                     savedProduct = { ...product, ...safePayload } as ProductReference;
                } else {
                    throw error;
                }
            } else {
                savedProduct = { ...product, ...payload } as ProductReference;
            }
            
            setReferences(prev => prev.map(r => r.id === product.id ? savedProduct : r));
        } else {
            // Insert
            const newId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9);
            const newProduct = { ...payload, id: newId };
            
            const { error } = await supabase.from('products').insert([newProduct]);
            
            if (error) {
                 // FALLBACK
                 if (error.code === '42703') {
                     console.warn("Column missing, retrying without estimatedPiecesPerRoll");
                     const { estimatedPiecesPerRoll, ...safePayload } = newProduct;
                     const { error: retryError } = await supabase.from('products').insert([safePayload]);
                     if (retryError) throw retryError;
                     
                     alert("Produto salvo, mas o campo 'Estimativa Peças/Rolo' não foi gravado pois a coluna não existe no banco de dados.");
                     savedProduct = safePayload as ProductReference;
                 } else {
                     throw error;
                 }
            } else {
                savedProduct = newProduct as ProductReference;
            }
            setReferences(prev => [...prev, savedProduct]);
        }
    } catch (error: any) {
        console.error("Error saving product:", error);
        alert(`Erro ao salvar produto: ${error.message || 'Erro desconhecido'}.`);
    }
  };

  const handleSaveSeamstress = async (seamstress: Omit<Seamstress, 'id'> | Seamstress) => {
      try {
          let savedSeamstress: Seamstress;
          if ('id' in seamstress) {
              const { error } = await supabase.from('seamstresses').update(seamstress).eq('id', seamstress.id);
              if (error) throw error;
              savedSeamstress = seamstress as Seamstress;
              setSeamstresses(prev => prev.map(s => s.id === seamstress.id ? savedSeamstress : s));
          } else {
              const newId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9);
              const newSeamstress = { ...seamstress, id: newId };
              const { error } = await supabase.from('seamstresses').insert([newSeamstress]);
              if (error) throw error;
              savedSeamstress = newSeamstress as Seamstress;
              setSeamstresses(prev => [...prev, savedSeamstress]);
          }
      } catch (error) {
          console.error("Error saving seamstress:", error);
          alert("Erro ao salvar costureira.");
      }
  };

  const handleSaveFabric = async (fabric: Omit<Fabric, 'id' | 'createdAt' | 'updatedAt'> | Fabric) => {
    try {
        const timestamp = new Date().toISOString();
        let savedFabric: Fabric;

        if ('id' in fabric) {
            // Update
            const { error } = await supabase.from('fabrics').update({ ...fabric, updatedAt: timestamp }).eq('id', fabric.id);
            if(error) throw error;
            savedFabric = { ...fabric, updatedAt: timestamp } as Fabric;
            setFabrics(prev => prev.map(f => f.id === fabric.id ? savedFabric : f));
        } else {
            // Insert
            const newId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9);
            const newFabric = { ...fabric, id: newId, createdAt: timestamp, updatedAt: timestamp };
            
            const { error } = await supabase.from('fabrics').insert([newFabric]);
            if(error) throw error;
            
            savedFabric = newFabric as Fabric;
            setFabrics(prev => [...prev, savedFabric]);
        }
    } catch (error) {
        console.error("Error saving fabric:", error);
        alert("Erro ao salvar tecido.");
    }
  };

  const handleQuickStockAdd = async (fabric: Fabric) => {
      const input = window.prompt(`Adicionar estoque para ${fabric.name} - ${fabric.color}.\n\nQuantos rolos entraram?`, '0');
      if (input === null) return;
      
      const amountToAdd = parseFloat(input.replace(',', '.'));
      if (isNaN(amountToAdd) || amountToAdd <= 0) {
          alert('Por favor, insira um número válido maior que zero.');
          return;
      }

      const newStock = parseFloat((fabric.stockRolls + amountToAdd).toFixed(2));
      const updatedAt = new Date().toISOString();

      try {
          const { error } = await supabase.from('fabrics').update({ 
              stockRolls: newStock,
              updatedAt: updatedAt
          }).eq('id', fabric.id);

          if (error) throw error;

          const updatedFabric = { ...fabric, stockRolls: newStock, updatedAt };
          setFabrics(prev => prev.map(f => f.id === fabric.id ? updatedFabric : f));
          alert(`Estoque atualizado! Novo saldo: ${newStock} rolos.`);
      } catch (error) {
          console.error("Error adding stock:", error);
          alert("Erro ao atualizar estoque.");
      }
  };

  const initiateMoveToCutting = async (order: ProductionOrder) => {
    const updatedAt = new Date().toISOString();
    try {
        // STOCK DEDUCTION LOGIC
        // We need to iterate over items and find matching fabric records
        // IMPORTANT: We do this optimistically in UI, but critically we must update DB.
        
        const updates = [];
        const fabricUpdates = [...fabrics]; // Clone local state to update UI instantly

        for (const item of order.items) {
             const fabricRecIndex = fabricUpdates.findIndex(f => 
                 f.name.toLowerCase() === order.fabric.toLowerCase() && 
                 f.color.toLowerCase() === item.color.toLowerCase()
             );

             if (fabricRecIndex > -1) {
                 // Found matching fabric stock
                 const fabricRec = fabricUpdates[fabricRecIndex];
                 const used = Number(item.rollsUsed) || 0;
                 
                 // Subtract stock
                 const newStock = Math.max(0, fabricRec.stockRolls - used);
                 
                 // Update local clone
                 fabricUpdates[fabricRecIndex] = { ...fabricRec, stockRolls: newStock, updatedAt };

                 // Queue DB update
                 updates.push(
                     supabase.from('fabrics').update({ stockRolls: newStock, updatedAt }).eq('id', fabricRec.id)
                 );
             }
        }

        // Execute all fabric updates
        if (updates.length > 0) {
            await Promise.all(updates);
            setFabrics(fabricUpdates); // Update UI state
        }

        // Move Order Status
        const { error } = await supabase
            .from('orders')
            .update({ status: OrderStatus.CUTTING, updatedAt })
            .eq('id', order.id);
        
        if (error) throw error;

        setOrders(orders.map(o => o.id === order.id ? { ...o, status: OrderStatus.CUTTING, updatedAt } : o));
        setProductionStage(OrderStatus.CUTTING);
        
        if (updates.length > 0) {
            alert("Ordem movida para corte. Estoque de tecidos atualizado automaticamente!");
        }

    } catch (error) {
        console.error("Error moving to cutting:", error);
        alert("Erro ao atualizar status e estoque.");
    }
  };
  
  const initiateConfirmCut = (order: ProductionOrder) => {
    setCuttingOrder(order);
  }

  const confirmCut = async (updatedTotalItems: ProductionOrderItem[], activeItems: ProductionOrderItem[]) => {
    if (!cuttingOrder) return;
    const updatedAt = new Date().toISOString();
    
    try {
        const { error } = await supabase
            .from('orders')
            .update({
                items: updatedTotalItems,
                activeCuttingItems: activeItems,
                updatedAt
            })
            .eq('id', cuttingOrder.id);

        if (error) throw error;

        setOrders(orders.map(o => {
          if (o.id === cuttingOrder.id) {
            return {
              ...o,
              items: updatedTotalItems,
              activeCuttingItems: activeItems,
              updatedAt
            };
          }
          return o;
        }));
        setCuttingOrder(null);
    } catch (error) {
        console.error("Error confirming cut:", error);
        alert("Erro ao confirmar corte.");
    }
  };

  const initiateDistribute = (order: ProductionOrder) => {
    setDistributingOrder(order);
  };

  const handleDistribute = async (originalOrderId: string, distributionMap: {color: string, sizes: SizeDistribution}[], seamstressId: string) => {
    const originalOrder = orders.find(o => o.id === originalOrderId);
    if (!originalOrder) return;
    const seamstress = seamstresses.find(s => s.id === seamstressId);
    if (!seamstress) return;

    const splitItems: ProductionOrderItem[] = [];
    const updatedActiveItems = [...originalOrder.activeCuttingItems];

    distributionMap.forEach(dist => {
        const totalToSend = Object.values(dist.sizes).reduce((acc: number, curr) => acc + (Number(curr) || 0), 0);
        const originalItemRef = originalOrder.items.find(i => i.color === dist.color);

        splitItems.push({
            color: dist.color,
            colorHex: originalItemRef?.colorHex,
            rollsUsed: 0,
            piecesPerSizeEst: 0,
            estimatedPieces: totalToSend,
            actualPieces: totalToSend,
            sizes: dist.sizes
        });

        const itemIndex = updatedActiveItems.findIndex(i => i.color === dist.color);
        if (itemIndex > -1) {
            const activeItem = updatedActiveItems[itemIndex];
            const remainingSizes = { ...activeItem.sizes };
            let remainingTotal = 0;

            Object.keys(remainingSizes).forEach(key => {
                const current = remainingSizes[key] || 0;
                const sent = dist.sizes[key] || 0;
                remainingSizes[key] = Math.max(0, current - sent);
                remainingTotal += remainingSizes[key]!;
            });

            updatedActiveItems[itemIndex] = {
                ...activeItem,
                sizes: remainingSizes,
                actualPieces: remainingTotal
            };
        }
    });
    
    const newId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `split-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newSplit: OrderSplit = {
        id: newId,
        seamstressId: seamstress.id,
        seamstressName: seamstress.name,
        status: OrderStatus.SEWING,
        items: splitItems,
        createdAt: new Date().toISOString()
    };

    const newSplits = [...(originalOrder.splits || []), newSplit];
    const updatedAt = new Date().toISOString();

    try {
        const { error } = await supabase
            .from('orders')
            .update({
                activeCuttingItems: updatedActiveItems,
                splits: newSplits,
                status: OrderStatus.SEWING,
                updatedAt
            })
            .eq('id', originalOrderId);

        if (error) throw error;

        setOrders(prev => prev.map(o => {
            if (o.id === originalOrderId) {
                return {
                    ...o,
                    activeCuttingItems: updatedActiveItems,
                    splits: newSplits,
                    status: OrderStatus.SEWING,
                    updatedAt
                };
            }
            return o;
        }));
        
        if (originalOrder.status === OrderStatus.CUTTING) {
            setProductionStage(OrderStatus.SEWING);
        }
    } catch (error) {
        console.error("Error distributing:", error);
        alert("Erro ao distribuir para costura.");
    }
  };

  const handleMarkSplitFinished = async (orderId: string, splitIndex: number) => {
      const order = orders.find(o => o.id === orderId);
      if(!order) return;

      const updatedSplits = [...order.splits];
      if (!updatedSplits[splitIndex]) return;

      updatedSplits[splitIndex] = {
          ...updatedSplits[splitIndex],
          status: OrderStatus.FINISHED,
          finishedAt: new Date().toISOString()
      };

      const cuttingEmpty = order.activeCuttingItems.every(i => i.actualPieces === 0);
      const allSplitsFinished = updatedSplits.every(s => s.status === OrderStatus.FINISHED);
      
      const isNowFinished = (cuttingEmpty && allSplitsFinished);
      const newStatus = isNowFinished ? OrderStatus.FINISHED : OrderStatus.SEWING;
      
      const finishedAt = isNowFinished ? new Date().toISOString() : order.finishedAt;
      const updatedAt = new Date().toISOString();

      try {
          const { error } = await supabase
            .from('orders')
            .update({
                splits: updatedSplits,
                status: newStatus,
                updatedAt,
                finishedAt
            })
            .eq('id', orderId);
          
          if(error) throw error;

          setOrders(prev => prev.map(o => {
              if (o.id === orderId) {
                  return { 
                      ...o, 
                      splits: updatedSplits, 
                      status: newStatus, 
                      updatedAt,
                      finishedAt
                  }
              }
              return o;
          }))
      } catch (error) {
          console.error("Error finishing split:", error);
          alert("Erro ao dar baixa.");
      }
  }

  const handleGenerateAiReport = async () => {
    setLoadingAi(true);
    const report = await generateProductionInsights(orders, seamstresses);
    setAiInsights(report);
    setLoadingAi(false);
  };

  const handlePrintPlannedOrders = () => {
    // Sort orders by ID for the print report
    const plannedOrders = orders
        .filter(o => o.status === OrderStatus.PLANNED)
        .sort((a, b) => {
            const numA = Number(a.id);
            const numB = Number(b.id);
            // If both are numbers, sort numerically ascending
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            // Otherwise sort alphanumerically
            return a.id.localeCompare(b.id);
        });
    
    if (plannedOrders.length === 0) {
        alert("Não há pedidos planejados para imprimir.");
        return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <html>
        <head>
          <title>Ordens Planejadas - Kavin's</title>
          <style>
            body { font-family: 'Arial', sans-serif; padding: 20px; }
            .order-card { 
                border: 2px solid #000; 
                margin-bottom: 20px; 
                page-break-inside: avoid;
                padding: 10px;
            }
            .header {
                font-size: 16px;
                border-bottom: 1px solid #ccc;
                padding-bottom: 10px;
                margin-bottom: 10px;
            }
            .header-row {
                display: flex;
                gap: 20px;
                margin-bottom: 5px;
            }
            .label { font-weight: bold; }
            .colors-container {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .color-row {
                display: flex;
                align-items: center;
                border-bottom: 1px dashed #eee;
                padding: 5px 0;
            }
            .color-name {
                font-weight: bold;
                /* Removed fixed width */
            }
            .fabric-code {
                font-size: 14px;
                margin-left: 8px; /* The specific request: small space */
                margin-right: 20px;
            }
            .rolls-qty {
                width: 100px;
            }
            .notes-space {
                flex: 1;
                border-bottom: 1px solid #ddd;
                height: 20px;
            }
            @media print {
                button { display: none; }
            }
          </style>
        </head>
        <body>
          <h2 style="text-align:center; margin-bottom: 20px;">Relatório de Corte - Planejados</h2>
          
          ${plannedOrders.map(order => {
              let sizesStr = '';
              if (order.gridType === 'STANDARD') sizesStr = 'P, M, G, GG';
              else if (order.gridType === 'PLUS') sizesStr = 'G1, G2, G3';
              else if (order.items.length > 0) sizesStr = Object.keys(order.items[0].sizes).join(', ');

              return `
              <div class="order-card">
                  <div class="header">
                      <div class="header-row">
                          <span><span class="label">Pedido:</span> #${order.id}</span>
                          <span><span class="label">Ref:</span> ${order.referenceCode}</span>
                          <span><span class="label">Tecido:</span> ${order.fabric}</span>
                          <span><span class="label">Grade:</span> ${sizesStr}</span>
                      </div>
                      <div class="header-row">
                          <span><span class="label">Descrição:</span> ${order.description}</span>
                      </div>
                      <div class="header-row">
                           <span style="font-size: 12px; color: #666;">Obs: ${order.notes || '-'}</span>
                      </div>
                  </div>
                  
                  <div class="colors-container">
                      ${order.items.map(item => {
                          // Find matching fabric record to get notes
                          const matchedFabric = fabrics.find(f => 
                              f.name.toLowerCase() === order.fabric.toLowerCase() && 
                              f.color.toLowerCase() === item.color.toLowerCase()
                          );
                          const fabricCode = matchedFabric?.notes ? matchedFabric.notes : '-';

                          return `
                          <div class="color-row">
                              <span class="color-name">${item.color}</span>
                              <span class="fabric-code">Cód: ${fabricCode}</span>
                              <span class="rolls-qty">Rolos: ${item.rollsUsed}</span>
                              <div class="notes-space"></div>
                          </div>
                      `}).join('')}
                  </div>
              </div>
              `;
          }).join('')}

          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handlePrintFabrics = () => {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const htmlContent = `
        <html>
          <head>
            <title>Estoque de Tecidos - Kavin's</title>
            <style>
              body { font-family: 'Arial', sans-serif; padding: 20px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              .color-box { display: inline-block; width: 15px; height: 15px; border: 1px solid #ccc; margin-right: 5px; vertical-align: middle; }
              h2 { text-align: center; color: #333; }
              .date { text-align: right; font-size: 12px; color: #666; margin-bottom: 20px; }
            </style>
          </head>
          <body>
            <h2>Relatório de Estoque de Tecidos</h2>
            <div class="date">Gerado em: ${new Date().toLocaleString()}</div>
            
            <table>
              <thead>
                <tr>
                  <th>Tecido</th>
                  <th>Cor</th>
                  <th>Rolos (Qtd)</th>
                  <th>Obs</th>
                  <th>Atualizado em</th>
                </tr>
              </thead>
              <tbody>
                ${filteredFabrics.map(f => `
                  <tr>
                    <td><b>${f.name}</b></td>
                    <td><span class="color-box" style="background-color: ${f.colorHex}"></span>${f.color}</td>
                    <td>${f.stockRolls}</td>
                    <td>${f.notes || '-'}</td>
                    <td>${new Date(f.updatedAt).toLocaleDateString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <script>
                window.onload = function() { window.print(); }
            </script>
          </body>
        </html>
      `;
      printWindow.document.write(htmlContent);
      printWindow.document.close();
  };

  // --- REPORT FILTER LOGIC ---
  const reportData = useMemo(() => {
      let filtered = orders;

      // Filter by Date
      if (reportFilters.startDate) {
          filtered = filtered.filter(o => new Date(o.createdAt) >= new Date(reportFilters.startDate));
      }
      if (reportFilters.endDate) {
          filtered = filtered.filter(o => new Date(o.createdAt) <= new Date(reportFilters.endDate));
      }

      // Filter by Reference (Text)
      if (reportFilters.reference) {
          const term = reportFilters.reference.toLowerCase();
          filtered = filtered.filter(o => 
              o.referenceCode.toLowerCase().includes(term) || 
              o.description.toLowerCase().includes(term)
          );
      }

      // Filter by Status (Order Level)
      if (reportFilters.status) {
          filtered = filtered.filter(o => o.status === reportFilters.status);
      }

      // Filter by Fabric
      if (reportFilters.fabric) {
          filtered = filtered.filter(o => o.fabric === reportFilters.fabric);
      }

      // Filter by Seamstress (Requires check in Splits)
      if (reportFilters.seamstressId) {
          filtered = filtered.filter(o => (o.splits || []).some(s => s.seamstressId === reportFilters.seamstressId));
      }

      // Calculate Totals for the Report View
      let totalCut = 0;
      let totalSewn = 0;
      let totalOrdersCount = filtered.length;
      let totalRolls = 0;

      filtered.forEach(o => {
          totalCut += o.items.reduce((acc, i) => acc + i.actualPieces, 0); // Only counts if cut confirmed
          totalRolls += o.items.reduce((acc, i) => acc + (Number(i.rollsUsed) || 0), 0);
          totalSewn += (o.splits || [])
              .filter(s => s.status === OrderStatus.FINISHED)
              .reduce((acc, s) => acc + s.items.reduce((i, item) => i + item.actualPieces, 0), 0);
      });

      return { filteredOrders: filtered, totalCut, totalSewn, totalOrdersCount, totalRolls };
  }, [orders, reportFilters]);

  // Fabric Filtering
  const filteredFabrics = useMemo(() => {
    return fabrics.filter(f => {
        const matchesName = f.name.toLowerCase().includes(fabricFilters.name.toLowerCase());
        const matchesColor = f.color.toLowerCase().includes(fabricFilters.color.toLowerCase());
        return matchesName && matchesColor;
    });
  }, [fabrics, fabricFilters]);


  const filteredOrders = orders.filter(o => 
    (o.referenceCode.toLowerCase().includes(searchTerm.toLowerCase()) || 
    o.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.id.includes(searchTerm)) &&
    o.status === productionStage
  );

  const getStageIcon = (stage: OrderStatus) => {
      switch(stage) {
          case OrderStatus.PLANNED: return ClipboardList;
          case OrderStatus.CUTTING: return Scissors;
          case OrderStatus.SEWING: return Shirt;
          case OrderStatus.FINISHED: return CheckCircle2;
          default: return ClipboardList;
      }
  }

  if (isLoading) {
      return (
          <div className="flex h-screen items-center justify-center bg-slate-50">
              <div className="text-center">
                  <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
                  <h2 className="text-xl font-bold text-slate-700">Carregando Sistema Kavin's...</h2>
                  <p className="text-slate-500">Conectando ao banco de dados.</p>
              </div>
          </div>
      )
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-64 bg-indigo-950 text-white flex-shrink-0 flex flex-col shadow-xl z-20">
        <div className="p-8">
          <h1 className="text-3xl font-bold tracking-tighter bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Kavin's
          </h1>
          <p className="text-xs text-indigo-300 mt-1 uppercase tracking-widest">Confecção & Gestão</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-indigo-200 hover:bg-white/10'}`}>
            <LayoutDashboard size={20} /> <span className="font-medium">Dashboard</span>
          </button>
          
          <button onClick={() => setActiveTab('production')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'production' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-indigo-200 hover:bg-white/10'}`}>
            <Scissors size={20} /> <span className="font-medium">Produção</span>
          </button>
          
          <button onClick={() => setActiveTab('fabrics')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'fabrics' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-indigo-200 hover:bg-white/10'}`}>
            <Layers size={20} /> <span className="font-medium">Estoque de Tecidos</span>
          </button>

          <button onClick={() => setActiveTab('reports')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'reports' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-indigo-200 hover:bg-white/10'}`}>
            <FileText size={20} /> <span className="font-medium">Relatórios</span>
          </button>

          <button onClick={() => setActiveTab('products')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'products' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-indigo-200 hover:bg-white/10'}`}>
            <Tags size={20} /> <span className="font-medium">Cadastros</span>
          </button>

          <button onClick={() => setActiveTab('seamstresses')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'seamstresses' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-indigo-200 hover:bg-white/10'}`}>
            <Users size={20} /> <span className="font-medium">Costureiras</span>
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        <header className="sticky top-0 bg-white/80 backdrop-blur-md z-10 border-b border-slate-200 px-8 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800">
            {activeTab === 'dashboard' && 'Visão Geral'}
            {activeTab === 'production' && 'Gerenciamento de Produção'}
            {activeTab === 'reports' && 'Relatórios e Análises'}
            {activeTab === 'products' && 'Catálogo de Produtos'}
            {activeTab === 'seamstresses' && 'Equipe de Costura'}
            {activeTab === 'fabrics' && 'Controle de Estoque de Tecidos'}
          </h2>
          
          <div className="flex items-center gap-4">
            {activeTab === 'production' && (
              <>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type="text" placeholder="Buscar ordem..." className="pl-10 pr-4 py-2 rounded-full border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-indigo-100 outline-none w-64 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                
                {productionStage === OrderStatus.PLANNED && (
                    <button onClick={handlePrintPlannedOrders} className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-full font-medium flex items-center gap-2 shadow-sm transition-all active:scale-95">
                        <Printer size={18} /> Imprimir Lista
                    </button>
                )}

                <button onClick={() => { setOrderToEdit(null); setIsOrderModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full font-medium flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95">
                    <Plus size={18} /> Nova Ordem
                </button>
              </>
            )}
            
            {activeTab === 'products' && (
              <button onClick={() => { setEditingProduct(null); setIsProductModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full font-medium flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95">
                <Plus size={18} /> Novo Produto
              </button>
            )}

            {activeTab === 'fabrics' && (
              <>
                 <button onClick={handlePrintFabrics} className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-full font-medium flex items-center gap-2 shadow-sm transition-all active:scale-95">
                    <Printer size={18} /> Imprimir Estoque
                 </button>
                 <button onClick={() => { setFabricToEdit(null); setIsFabricModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full font-medium flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95">
                   <Plus size={18} /> Entrada de Tecido
                 </button>
              </>
            )}
            
             {activeTab === 'seamstresses' && (
              <button onClick={() => { setSeamstressToEdit(null); setIsSeamstressModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full font-medium flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95">
                <Plus size={18} /> Nova Costureira
              </button>
            )}
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto space-y-8">
          
          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Pedidos Planejados" value={dashboardMetrics.plannedOrdersCount} icon={ClipboardList} color="bg-blue-500" trend="Aguardando Corte" />
                <StatCard title="Costureiras Ativas" value={dashboardMetrics.activeSeamstressesCount} icon={Users} color="bg-pink-500" trend="Costurando agora" />
                <StatCard title="Produzido (Mês)" value={dashboardMetrics.monthPiecesProduced} icon={CalendarDays} color="bg-indigo-500" trend="Peças finalizadas" />
                <StatCard title="Em Corte (Ativo)" value={dashboardMetrics.cuttingOrders} icon={Scissors} color="bg-purple-500" trend="Aguardando distribuição" />
              </div>
              
              {/* Charts ... (Keeping Dashboard simplified for this update diff) */}
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 {/* Main Weekly Chart */}
                 <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <TrendingUp size={20} className="text-indigo-600"/> Produção Semanal (7 Dias)
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dashboardMetrics.weeklyData}>
                                <defs>
                                    <linearGradient id="colorPieces" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10}/>
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}}/>
                                <Tooltip contentStyle={{backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} itemStyle={{color: '#4f46e5', fontWeight: 'bold'}} />
                                <Area type="monotone" dataKey="peças" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorPieces)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                 </div>
                 
                 {/* Monthly Chart */}
                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <CalendarDays size={20} className="text-emerald-600"/> Produção Mensal
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dashboardMetrics.monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10}/>
                                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0'}} itemStyle={{color: '#10b981', fontWeight: 'bold'}} />
                                <Bar dataKey="peças" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                 </div>
              </div>
            </div>
          )}

          {/* FABRICS TAB */}
          {activeTab === 'fabrics' && (
             <div className="space-y-6">
                 {/* Filters */}
                 <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-4 items-center flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-bold text-slate-500 mb-1">Buscar Tecido</label>
                        <input 
                            type="text" 
                            placeholder="Ex: Viscose..." 
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-indigo-100 outline-none"
                            value={fabricFilters.name}
                            onChange={e => setFabricFilters({...fabricFilters, name: e.target.value})}
                        />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-bold text-slate-500 mb-1">Buscar Cor</label>
                        <input 
                            type="text" 
                            placeholder="Ex: Azul..." 
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-indigo-100 outline-none"
                            value={fabricFilters.color}
                            onChange={e => setFabricFilters({...fabricFilters, color: e.target.value})}
                        />
                    </div>
                 </div>

                 {/* Grid of Fabrics */}
                 <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {filteredFabrics.map(fabric => (
                        <div key={fabric.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 relative group transition-all hover:shadow-md hover:border-indigo-200">
                             <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { setFabricToEdit(fabric); setIsFabricModalOpen(true); }} className="text-slate-400 hover:text-indigo-600 p-1 bg-white rounded shadow-sm" title="Editar">
                                    <Edit2 size={16} />
                                </button>
                                <button onClick={() => handleQuickStockAdd(fabric)} className="text-emerald-500 hover:text-emerald-700 p-1 bg-white rounded shadow-sm hover:bg-emerald-50" title="Adicionar Estoque">
                                    <PlusCircle size={16} />
                                </button>
                             </div>

                             <div className="flex items-center gap-3 mb-4">
                                 <div 
                                    className="w-12 h-12 rounded-full border-2 border-slate-100 shadow-inner" 
                                    style={{backgroundColor: fabric.colorHex}}
                                 ></div>
                                 <div>
                                     <h3 className="font-bold text-slate-800 text-lg">{fabric.name}</h3>
                                     <p className="text-xs text-slate-500 font-medium">{fabric.color}</p>
                                 </div>
                             </div>
                             
                             <div className="bg-slate-50 rounded-xl p-3 mb-3 border border-slate-100">
                                 <p className="text-center">
                                     <span className="block text-xs text-slate-400 uppercase tracking-wider">Estoque Atual</span>
                                     <span className={`text-2xl font-bold ${fabric.stockRolls < 10 ? 'text-red-500' : 'text-indigo-600'}`}>
                                         {fabric.stockRolls} <span className="text-sm text-slate-400 font-normal">rolos</span>
                                     </span>
                                 </p>
                             </div>

                             <div className="text-xs text-slate-400 border-t border-slate-50 pt-3">
                                 <p className="mb-1">
                                     <Clock size={10} className="inline mr-1"/> 
                                     Atualizado: {new Date(fabric.updatedAt).toLocaleDateString()}
                                 </p>
                                 {fabric.notes && (
                                     <p className="italic text-slate-500 line-clamp-1">"{fabric.notes}"</p>
                                 )}
                             </div>
                        </div>
                    ))}
                    {filteredFabrics.length === 0 && (
                        <div className="col-span-full py-12 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                            <Layers size={48} className="mx-auto mb-3 opacity-20"/>
                            <p>Nenhum tecido encontrado no estoque.</p>
                        </div>
                    )}
                 </div>
             </div>
          )}

          {/* PRODUCTION TAB */}
          {activeTab === 'production' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[500px]">
              <div className="flex p-2 bg-slate-100/50 border-b border-slate-200">
                {(Object.values(OrderStatus) as OrderStatus[]).map((status) => {
                    const Icon = getStageIcon(status);
                    const isActive = productionStage === status;
                    const count = stageCounts[status];
                    return (
                        <button key={status} onClick={() => setProductionStage(status)} className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-bold transition-all relative ${isActive ? 'bg-white text-indigo-700 shadow-md ring-1 ring-black/5' : 'text-slate-500 hover:bg-white/50 hover:text-slate-700'}`}>
                            <Icon size={16} className={isActive ? 'text-indigo-600' : 'text-slate-400'}/>
                            {status}
                            {count > 0 && <span className={`ml-1 text-xs px-2 py-0.5 rounded-full ${isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>{count}</span>}
                        </button>
                    );
                })}
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                      <th className="p-4 w-10"></th>
                      <th className="p-4">Pedido / Data</th>
                      <th className="p-4">Ref / Descrição</th>
                      <th className="p-4">Tecido</th>
                      <th className="p-4 text-center">Peças Totais</th>
                      <th className="p-4">Obs</th>
                      <th className="p-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-slate-400">
                           <div className="flex flex-col items-center gap-3">
                               <Archive size={48} className="text-slate-200" />
                               <p>Nenhum pedido na etapa <span className="font-bold text-slate-500">{productionStage}</span>.</p>
                           </div>
                        </td>
                      </tr>
                    ) : (
                      // Only show last 10 finished orders, otherwise show all
                      (productionStage === OrderStatus.FINISHED ? filteredOrders.slice(0, 10) : filteredOrders).map(order => {
                        const isExpanded = expandedOrders.includes(order.id);
                        const totalPieces = order.items.reduce((acc, i) => acc + (order.status === OrderStatus.PLANNED ? i.estimatedPieces : i.actualPieces), 0);
                        const itemsInCutting = order.activeCuttingItems.reduce((acc, i) => acc + i.actualPieces, 0);

                        return (
                          <React.Fragment key={order.id}>
                            <tr className={`hover:bg-slate-50 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-50/50' : ''}`} onClick={() => setExpandedOrders(prev => prev.includes(order.id) ? prev.filter(id => id !== order.id) : [...prev, order.id])}>
                              <td className="p-4 text-center">
                                <button className="text-slate-400 hover:text-indigo-600">
                                    {isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                </button>
                              </td>
                              <td className="p-4">
                                <div className="font-mono font-bold text-indigo-700 text-lg">#{order.id}</div>
                                <div className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleDateString('pt-BR')}</div>
                              </td>
                              <td className="p-4">
                                <div className="font-bold text-indigo-900">{order.referenceCode}</div>
                                <div className="text-slate-500">{order.description}</div>
                                <div className="flex mt-1 gap-1">
                                    {order.items.map(i => (
                                        <div key={i.color} className="w-3 h-3 rounded-full border border-slate-200" style={{backgroundColor: i.colorHex || '#999'}} title={i.color}></div>
                                    ))}
                                </div>
                              </td>
                              <td className="p-4 font-medium">{order.fabric}</td>
                              <td className="p-4 text-center">
                                <span className="font-bold text-slate-700 text-lg">{totalPieces}</span>
                                {order.status === OrderStatus.PLANNED && <span className="text-xs text-slate-400 ml-1 block">(Est)</span>}
                              </td>
                              <td className="p-4 max-w-xs truncate text-slate-500 italic">
                                  {order.notes || '-'}
                              </td>
                              <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex justify-end gap-2 items-center">
                                    {/* Action Buttons based on Status */}
                                    {order.status === OrderStatus.PLANNED && (
                                    <button onClick={() => initiateMoveToCutting(order)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md flex items-center gap-1">
                                        <Scissors size={14}/> Iniciar
                                    </button>
                                    )}
                                    {order.status === OrderStatus.CUTTING && itemsInCutting === 0 && order.activeCuttingItems.length === 0 && (
                                        <button onClick={() => initiateConfirmCut(order)} className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-md">
                                            <ClipboardList size={14} /> Confirmar
                                        </button>
                                    )}
                                    {/* Only show Distribute if there are pieces in cutting */}
                                    {((order.status === OrderStatus.CUTTING && itemsInCutting > 0) || order.status === OrderStatus.SEWING) && itemsInCutting > 0 && (
                                        <button onClick={() => initiateDistribute(order)} className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-md">
                                            <ArrowRightLeft size={14} /> Distribuir
                                        </button>
                                    )}

                                    {/* Edit / Delete */}
                                    <div className="h-6 w-px bg-slate-200 mx-1"></div>
                                    
                                    {/* Allow edit in PLANNED stage OR CUTTING (Pre-confirmation: activeCuttingItems empty) */}
                                    {(order.status === OrderStatus.PLANNED || (order.status === OrderStatus.CUTTING && order.activeCuttingItems.length === 0)) && (
                                        <button onClick={() => handleEditOrder(order)} className="text-slate-400 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded transition-colors" title="Editar Pedido">
                                            <Edit2 size={16} />
                                        </button>
                                    )}
                                    
                                    {/* Allow DELETE in PLANNED stage OR CUTTING (Pre-confirmation: activeCuttingItems empty) */}
                                    {(order.status === OrderStatus.PLANNED || (order.status === OrderStatus.CUTTING && order.activeCuttingItems.length === 0)) && (
                                        <button onClick={() => handleDeleteOrder(order.id)} className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded transition-colors" title="Excluir Pedido">
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                              </td>
                            </tr>
                            
                            {/* EXPANDED DETAILS */}
                            {isExpanded && (
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <td colSpan={7} className="p-6">
                                        <div className="flex flex-col gap-6">
                                            {/* Stock Area */}
                                            {(order.status === OrderStatus.CUTTING || order.status === OrderStatus.SEWING) && (
                                                <div className={`border rounded-xl p-4 shadow-sm ${order.status === OrderStatus.SEWING ? 'bg-slate-50 border-slate-200 opacity-90' : 'bg-white border-purple-100'}`}>
                                                    <div className="flex justify-between items-center mb-3">
                                                        <h4 className="font-bold text-slate-700 flex items-center gap-2"><Scissors size={18} className="text-purple-600"/> Estoque em Corte {order.status === OrderStatus.SEWING && '(Restante)'}</h4>
                                                    </div>
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                        {order.activeCuttingItems.length > 0 ? order.activeCuttingItems.map((item, idx) => (
                                                            <div key={idx} className={`p-3 rounded-lg border flex flex-col ${item.actualPieces > 0 ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-100 border-slate-200 opacity-50'}`}>
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <div className="w-3 h-3 rounded-full border border-slate-100" style={{backgroundColor: item.colorHex}}></div>
                                                                    <span className="font-bold text-sm text-slate-700">{item.color}</span>
                                                                </div>
                                                                <div className="flex justify-between items-end mt-auto">
                                                                    <div className="flex flex-wrap gap-1 max-w-[70%]">
                                                                        {Object.entries(item.sizes).map(([s, q]) => (q as number) > 0 && <span key={s} className="text-[10px] bg-slate-50 border border-slate-100 px-1 rounded text-slate-500">{s}:{q as number}</span>)}
                                                                    </div>
                                                                    <span className="font-bold text-lg text-slate-800">{item.actualPieces}</span>
                                                                </div>
                                                            </div>
                                                        )) : <p className="text-sm text-slate-400 italic col-span-4">Nenhum item restante no corte (ou aguardando confirmação).</p>}
                                                    </div>
                                                </div>
                                            )}
                                            {/* Splits Area */}
                                            {(order.splits || []).length > 0 && (
                                                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                                    <h4 className="font-bold text-slate-700 flex items-center gap-2 mb-3"><Users size={18} className="text-amber-600"/> Distribuições (Costureiras)</h4>
                                                    <div className="space-y-3">
                                                        {(order.splits || []).map((split, idx) => {
                                                            // Calculate 15-day deadline from creation
                                                            const deadlineDate = new Date(split.createdAt);
                                                            deadlineDate.setDate(deadlineDate.getDate() + 15);
                                                            const isLate = new Date() > deadlineDate && split.status !== OrderStatus.FINISHED;
                                                            
                                                            return (
                                                            <div key={`${split.id}-${idx}`} className="flex flex-col md:flex-row gap-4 border border-slate-100 rounded-lg p-3 hover:bg-slate-50 transition-colors">
                                                                <div className="flex-shrink-0 w-48 border-r border-slate-100 pr-4 flex flex-col justify-center">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">{split.seamstressName.charAt(0)}</div>
                                                                        <div className="font-medium text-slate-800">{split.seamstressName}</div>
                                                                    </div>
                                                                    <div className="mt-2 flex flex-col items-start gap-1">
                                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded w-fit ${split.status === OrderStatus.FINISHED ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>{split.status}</span>
                                                                        {split.status === OrderStatus.FINISHED && split.finishedAt && (
                                                                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                                                <Clock size={10} /> {new Date(split.finishedAt).toLocaleDateString()}
                                                                            </span>
                                                                        )}
                                                                        {split.status !== OrderStatus.FINISHED && (
                                                                            <span className={`text-[10px] flex items-center gap-1 mt-1 font-medium ${isLate ? 'text-red-500' : 'text-slate-400'}`}>
                                                                                <Calendar size={10} /> Previsão: {deadlineDate.toLocaleDateString()}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                                                                     {split.items.map((item, i) => (
                                                                         <div key={i} className="bg-white border border-slate-100 rounded p-2 text-sm">
                                                                             <div className="flex items-center gap-1 mb-1">
                                                                                 <div className="w-2 h-2 rounded-full" style={{backgroundColor: item.colorHex}}></div>
                                                                                 <span className="font-medium text-slate-600">{item.color}</span>
                                                                             </div>
                                                                             <div className="font-bold text-right text-slate-800 mb-1">{item.actualPieces} pçs</div>
                                                                             {/* SHOW SIZES BREAKDOWN */}
                                                                             <div className="flex flex-wrap gap-1 justify-end">
                                                                                 {Object.entries(item.sizes).map(([size, qty]) => (
                                                                                     (qty as number) > 0 && (
                                                                                         <span key={size} className="text-[10px] bg-slate-50 border border-slate-100 px-1 rounded text-slate-500">
                                                                                             {size}:{qty}
                                                                                         </span>
                                                                                     )
                                                                                 ))}
                                                                             </div>
                                                                         </div>
                                                                     ))}
                                                                </div>
                                                                <div className="flex-shrink-0 flex items-center pl-2 border-l border-slate-100">
                                                                    {split.status !== OrderStatus.FINISHED ? (
                                                                        <button onClick={() => handleMarkSplitFinished(order.id, idx)} className="text-emerald-600 hover:bg-emerald-50 px-3 py-2 rounded-lg text-xs font-bold border border-emerald-200 flex items-center gap-1"><PackageCheck size={16} /> Baixa</button>
                                                                    ) : (
                                                                        <div className="text-emerald-500 flex flex-col items-center px-2"><CheckCircle2 size={20} /><span className="text-[10px] font-bold">Concluído</span></div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* REPORTS TAB */}
          {activeTab === 'reports' && (
              // ... existing report content ...
              <div className="space-y-6">
                  {/* Filter Bar */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-5 gap-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Data Início</label>
                          <input type="date" className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-indigo-100 outline-none" value={reportFilters.startDate} onChange={e => setReportFilters({...reportFilters, startDate: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Data Fim</label>
                          <input type="date" className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-indigo-100 outline-none" value={reportFilters.endDate} onChange={e => setReportFilters({...reportFilters, endDate: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Referência</label>
                          <input type="text" placeholder="Buscar ref..." className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-indigo-100 outline-none" value={reportFilters.reference} onChange={e => setReportFilters({...reportFilters, reference: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Tecido</label>
                          <select 
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-indigo-100 outline-none" 
                            value={reportFilters.fabric} 
                            onChange={e => setReportFilters({...reportFilters, fabric: e.target.value})}
                          >
                              <option value="">Todos</option>
                              {uniqueFabrics.map(fabric => <option key={fabric} value={fabric}>{fabric}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Costureira</label>
                          <select className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-indigo-100 outline-none" value={reportFilters.seamstressId} onChange={e => setReportFilters({...reportFilters, seamstressId: e.target.value})}>
                              <option value="">Todas</option>
                              {seamstresses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                      </div>
                      <div className="flex items-end col-span-1 md:col-span-5 justify-end">
                           <button 
                             onClick={() => setReportFilters({startDate: '', endDate: '', seamstressId: '', status: '', reference: '', fabric: ''})}
                             className="w-full md:w-auto px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-medium flex items-center justify-center gap-2"
                           >
                               <Filter size={16} /> Limpar Filtros
                           </button>
                      </div>
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
                          <div>
                              <p className="text-slate-500 text-sm">Total Cortado (Filtro)</p>
                              <h3 className="text-2xl font-bold text-slate-800">{reportData.totalCut}</h3>
                          </div>
                          <div className="p-3 bg-purple-50 text-purple-600 rounded-full"><Scissors size={24}/></div>
                      </div>
                      <div className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
                          <div>
                              <p className="text-slate-500 text-sm">Total Costurado (Filtro)</p>
                              <h3 className="text-2xl font-bold text-slate-800">{reportData.totalSewn}</h3>
                          </div>
                          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full"><Shirt size={24}/></div>
                      </div>
                      <div className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
                          <div>
                              <p className="text-slate-500 text-sm">Total de Rolos</p>
                              <h3 className="text-2xl font-bold text-slate-800">{reportData.totalRolls}</h3>
                          </div>
                          <div className="p-3 bg-blue-50 text-blue-600 rounded-full"><Scroll size={24}/></div>
                      </div>
                      <div className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
                          <div>
                              <p className="text-slate-500 text-sm">Registros Encontrados</p>
                              <h3 className="text-2xl font-bold text-slate-800">{reportData.totalOrdersCount}</h3>
                          </div>
                          <div className="p-3 bg-slate-50 text-slate-600 rounded-full"><FileText size={24}/></div>
                      </div>
                  </div>

                  {/* Detailed Table */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                      <table className="w-full text-left border-collapse">
                          <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                                  <th className="p-4">ID</th>
                                  <th className="p-4">Data Pedido</th>
                                  <th className="p-4">Ref / Descrição</th>
                                  <th className="p-4 text-center">Status</th>
                                  <th className="p-4 text-center">Qtd Corte</th>
                                  <th className="p-4">Data Entrega</th>
                                  <th className="p-4">Observações</th>
                                  <th className="p-4">Histórico de Costura</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                              {reportData.filteredOrders.map(order => (
                                  <tr key={order.id} className="hover:bg-slate-50">
                                      <td className="p-4 font-mono text-sm font-bold text-slate-700">#{order.id}</td>
                                      <td className="p-4 text-slate-500">{new Date(order.createdAt).toLocaleDateString()}</td>
                                      <td className="p-4">
                                          <div className="font-bold text-indigo-900">{order.referenceCode}</div>
                                          <div className="text-xs text-slate-500">{order.description}</div>
                                          <div className="text-[10px] text-slate-400 mt-1 uppercase font-semibold tracking-wider">{order.fabric}</div>
                                      </td>
                                      <td className="p-4 text-center">
                                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${order.status === OrderStatus.FINISHED ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{order.status}</span>
                                      </td>
                                      <td className="p-4 text-center font-bold">
                                          {order.items.reduce((acc, i) => acc + i.actualPieces, 0)}
                                      </td>
                                      <td className="p-4">
                                          {order.status === OrderStatus.FINISHED && order.finishedAt ? (
                                              <div className="flex items-center gap-1 text-emerald-600 font-medium">
                                                  <Clock size={14} />
                                                  {new Date(order.finishedAt).toLocaleDateString()}
                                              </div>
                                          ) : (
                                              <span className="text-slate-400">-</span>
                                          )}
                                      </td>
                                      <td className="p-4 text-slate-500 italic max-w-xs truncate">
                                          {order.notes || '-'}
                                      </td>
                                      <td className="p-4">
                                          <div className="space-y-3">
                                              {(order.splits || []).map((s, idx) => (
                                                  <div key={`${s.id}-${idx}`} className="text-sm bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                      <div className="flex justify-between items-center mb-1 border-b border-slate-200 pb-1">
                                                          <span className="font-bold text-slate-700">{s.seamstressName}</span>
                                                          <div className="text-right">
                                                              <div className={s.status === OrderStatus.FINISHED ? 'text-emerald-600 text-xs font-bold' : 'text-amber-600 text-xs font-bold'}>
                                                                  {s.status === OrderStatus.FINISHED ? 'Concluído' : 'Em Andamento'}
                                                              </div>
                                                              {s.status === OrderStatus.FINISHED && s.finishedAt && (
                                                                  <div className="text-[10px] text-slate-400">
                                                                      {new Date(s.finishedAt).toLocaleDateString()}
                                                                  </div>
                                                              )}
                                                          </div>
                                                      </div>
                                                      <div className="space-y-1 mt-1">
                                                          {s.items.map((item, idx) => {
                                                              // Find original rolls count for this color in the main order items
                                                              const originalItem = order.items.find(i => i.color === item.color);
                                                              const rolls = originalItem ? originalItem.rollsUsed : 0;
                                                              
                                                              return (
                                                                  <div key={idx} className="text-xs text-slate-600">
                                                                      <div className="flex items-center gap-2">
                                                                          <div className="w-2 h-2 rounded-full" style={{backgroundColor: item.colorHex}}></div>
                                                                          <span className="font-medium">{item.color}</span>
                                                                          <span className="text-slate-400">({rolls} rolos)</span>
                                                                      </div>
                                                                      <div className="pl-4 text-slate-500">
                                                                          {Object.entries(item.sizes)
                                                                              .filter(([_, q]) => (q as number) > 0)
                                                                              .map(([size, q]) => `${size}:${q}`)
                                                                              .join(', ')}
                                                                      </div>
                                                                  </div>
                                                              );
                                                          })}
                                                      </div>
                                                  </div>
                                              ))}
                                              {(order.splits || []).length === 0 && <span className="text-xs text-slate-400 italic">Sem distribuição</span>}
                                          </div>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          )}

          {/* PRODUCTS TAB */}
          {activeTab === 'products' && (
             <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                       <th className="p-4">Código</th>
                       <th className="p-4">Descrição</th>
                       <th className="p-4">Tecido</th>
                       <th className="p-4">Grade Padrão</th>
                       <th className="p-4">Cores Cadastradas</th>
                       <th className="p-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {references.map(ref => (
                      <tr key={ref.id} className="hover:bg-slate-50">
                        <td className="p-4 font-bold text-indigo-900">{ref.code}</td>
                        <td className="p-4">{ref.description}</td>
                        <td className="p-4">{ref.defaultFabric}</td>
                        <td className="p-4">
                           <span className="px-2 py-1 bg-slate-100 rounded text-xs">
                             {ref.defaultGrid === 'STANDARD' ? 'Padrão (P-GG)' : ref.defaultGrid === 'PLUS' ? 'Plus (G1-G3)' : 'Personalizado'}
                           </span>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2 flex-wrap">
                            {(ref.defaultColors || []).map(c => (
                              <div key={c.name} className="flex items-center gap-1 text-xs bg-white border border-slate-200 pl-1 pr-2 py-1 rounded-full shadow-sm" title={c.name}>
                                <div className="w-3 h-3 rounded-full border border-slate-100" style={{ backgroundColor: c.hex }}></div>
                                <span className="text-slate-600">{c.name}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => {setEditingProduct(ref); setIsProductModalOpen(true);}} className="text-indigo-400 hover:text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg transition-colors">
                                <Edit2 size={16} />
                            </button>
                            <button onClick={() => handleDeleteProduct(ref.id)} className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          )}

          {/* SEAMSTRESSES TAB */}
          {activeTab === 'seamstresses' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {seamstresses.map(seamstress => {
                const activeSplits = orders.reduce((acc, o) => acc + (o.splits || []).filter(s => s.seamstressId === seamstress.id && s.status === OrderStatus.SEWING).length, 0);
                const completedSplits = orders.reduce((acc, o) => acc + (o.splits || []).filter(s => s.seamstressId === seamstress.id && s.status === OrderStatus.FINISHED).length, 0);
                
                return (
                  <div key={seamstress.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative group">
                    <button 
                        onClick={() => { setSeamstressToEdit(seamstress); setIsSeamstressModalOpen(true); }}
                        className="absolute top-4 right-4 text-slate-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <Edit2 size={18} />
                    </button>

                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-xl font-bold">
                          {seamstress.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800">{seamstress.name}</h3>
                          <p className="text-xs text-slate-500">{seamstress.specialty} • {seamstress.phone}</p>
                          {seamstress.city && <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-1"><MapPin size={10}/> {seamstress.city}</p>}
                        </div>
                      </div>
                      <span className={`w-3 h-3 rounded-full ${seamstress.active ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 rounded-xl p-4 mb-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-amber-500">{activeSplits}</p>
                        <p className="text-xs font-medium text-slate-500 uppercase">Em andamento</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-emerald-500">{completedSplits}</p>
                        <p className="text-xs font-medium text-slate-500 uppercase">Finalizados</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                       <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Trabalhos Recentes</h4>
                       {orders.flatMap(o => (o.splits || []).filter(s => s.seamstressId === seamstress.id).map(s => ({...s, orderCode: o.referenceCode}))).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 3).map((split, i) => (
                         <div key={i} className="text-sm flex justify-between items-center py-1 border-b border-slate-100 last:border-0">
                           <div className="flex flex-col">
                             <span className="text-slate-600 truncate max-w-[120px]">{split.orderCode}</span>
                             <span className="text-xs text-slate-400">{split.items.length} cores</span>
                           </div>
                           <span className={`text-xs px-2 py-0.5 rounded-full ${split.status === OrderStatus.FINISHED ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                             {split.status === OrderStatus.FINISHED ? 'Feito' : 'Fazendo'}
                           </span>
                         </div>
                       ))}
                       {orders.flatMap(o => (o.splits || []).filter(s => s.seamstressId === seamstress.id)).length === 0 && <span className="text-xs text-slate-400 italic">Nenhum histórico recente.</span>}
                    </div>
                  </div>
                )
              })}
              
              <button 
                onClick={() => { setSeamstressToEdit(null); setIsSeamstressModalOpen(true); }}
                className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center mb-3 transition-colors">
                  <Plus size={24} className="group-hover:text-indigo-600" />
                </div>
                <span className="font-medium">Cadastrar Costureira</span>
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <OrderModal 
        isOpen={isOrderModalOpen} 
        onClose={() => setIsOrderModalOpen(false)} 
        onSave={handleCreateOrder} 
        references={references}
        orderToEdit={orderToEdit}
        suggestedId={nextOrderId}
      />

      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSave={handleSaveProduct}
        productToEdit={editingProduct}
        fabrics={fabrics}
      />

      <SeamstressModal
        isOpen={isSeamstressModalOpen}
        onClose={() => setIsSeamstressModalOpen(false)}
        onSave={handleSaveSeamstress}
        seamstressToEdit={seamstressToEdit}
      />

      <FabricModal
        isOpen={isFabricModalOpen}
        onClose={() => setIsFabricModalOpen(false)}
        onSave={handleSaveFabric}
        fabricToEdit={fabricToEdit}
      />

      <CutConfirmationModal
        isOpen={!!cuttingOrder}
        onClose={() => setCuttingOrder(null)}
        order={cuttingOrder}
        onConfirm={confirmCut}
      />

      <DistributeModal 
        isOpen={!!distributingOrder}
        onClose={() => setDistributingOrder(null)}
        order={distributingOrder}
        seamstresses={seamstresses}
        onDistribute={handleDistribute}
      />
    </div>
  );
}