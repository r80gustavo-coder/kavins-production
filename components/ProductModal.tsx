import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2, Edit2 } from 'lucide-react';
import { ProductReference, GridType, ProductColor } from '../types';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Omit<ProductReference, 'id'> | ProductReference) => void;
  productToEdit?: ProductReference | null;
}

export const ProductModal: React.FC<ProductModalProps> = ({ isOpen, onClose, onSave, productToEdit }) => {
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    defaultFabric: '',
    defaultColors: [] as ProductColor[],
    defaultGrid: 'STANDARD' as GridType,
  });
  
  // New Color State
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#000000');

  useEffect(() => {
    if (isOpen) {
      if (productToEdit) {
        setFormData({
          code: productToEdit.code,
          description: productToEdit.description,
          defaultFabric: productToEdit.defaultFabric,
          defaultColors: productToEdit.defaultColors,
          defaultGrid: productToEdit.defaultGrid,
        });
      } else {
        // Reset for new product
        setFormData({ code: '', description: '', defaultFabric: '', defaultColors: [], defaultGrid: 'STANDARD' });
      }
      setNewColorName('');
      setNewColorHex('#000000');
    }
  }, [isOpen, productToEdit]);

  if (!isOpen) return null;

  const handleAddColor = () => {
    if (newColorName.trim()) {
      setFormData(prev => ({
        ...prev,
        defaultColors: [...prev.defaultColors, { name: newColorName.trim(), hex: newColorHex }]
      }));
      setNewColorName('');
      // Keep the hex or reset? Let's keep it to allow slight variations or reset to black.
    }
  };

  const removeColor = (index: number) => {
    setFormData(prev => ({
      ...prev,
      defaultColors: prev.defaultColors.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (productToEdit) {
      onSave({ ...formData, id: productToEdit.id });
    } else {
      onSave(formData);
    }
    
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">
            {productToEdit ? 'Editar Produto' : 'Cadastrar Produto'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Código</label>
              <input
                required
                type="text"
                placeholder="Ex: REF-001"
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              />
            </div>
             <div className="col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Tecido Padrão</label>
              <input
                required
                type="text"
                placeholder="Ex: Viscose"
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.defaultFabric}
                onChange={e => setFormData({ ...formData, defaultFabric: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descrição / Modelo</label>
            <input
              required
              type="text"
              placeholder="Ex: Vestido Longo Floral"
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Grade Padrão</label>
            <select
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={formData.defaultGrid}
              onChange={e => setFormData({ ...formData, defaultGrid: e.target.value as GridType })}
            >
              <option value="STANDARD">Padrão (P ao GG)</option>
              <option value="PLUS">Plus Size (G1 ao G3)</option>
              <option value="CUSTOM">Personalizada</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Cores Disponíveis</label>
            
            <div className="flex gap-2 mb-4 items-end">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-500">Seletor</span>
                <input 
                  type="color" 
                  value={newColorHex}
                  onChange={e => setNewColorHex(e.target.value)}
                  className="h-10 w-12 rounded cursor-pointer border-0 p-0 bg-transparent"
                />
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Nome da cor (Ex: Azul Bebê)"
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newColorName}
                  onChange={e => setNewColorName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddColor())}
                />
              </div>
              <button 
                type="button" 
                onClick={handleAddColor}
                className="bg-indigo-100 text-indigo-600 p-2 rounded-lg hover:bg-indigo-200 h-10 w-10 flex items-center justify-center transition-colors"
              >
                <Plus size={20} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 min-h-[60px]">
              {formData.defaultColors.length === 0 && (
                <span className="text-sm text-slate-400 italic">Nenhuma cor cadastrada.</span>
              )}
              {formData.defaultColors.map((color, idx) => (
                <span key={idx} className="bg-white border border-slate-200 text-slate-700 pl-1 pr-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 shadow-sm">
                  <span 
                    className="w-4 h-4 rounded-full border border-slate-100" 
                    style={{ backgroundColor: color.hex }}
                  ></span>
                  {color.name}
                  <button type="button" onClick={() => removeColor(idx)} className="hover:text-red-500 ml-1"><X size={12} /></button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center gap-2"
            >
              <Save size={18} />
              {productToEdit ? 'Atualizar' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};