'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import type { Local } from '@/types/database';
import {
  MapPin,
  Plus,
  Trash2,
  Edit2,
  X,
  Save,
  Navigation,
  Loader2,
} from 'lucide-react';

// Cores disponíveis para os locais
const CORES_DISPONIVEIS = [
  { nome: 'Azul', valor: '#3B82F6' },
  { nome: 'Verde', valor: '#10B981' },
  { nome: 'Amarelo', valor: '#F59E0B' },
  { nome: 'Vermelho', valor: '#EF4444' },
  { nome: 'Roxo', valor: '#8B5CF6' },
  { nome: 'Rosa', valor: '#EC4899' },
  { nome: 'Laranja', valor: '#F97316' },
  { nome: 'Ciano', valor: '#06B6D4' },
];

interface NovoLocal {
  nome: string;
  latitude: number;
  longitude: number;
  raio: number;
  cor: string;
}

export default function LocaisPage() {
  const { user } = useAuthStore();
  const [locais, setLocais] = useState<Local[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Local | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: -23.5505, lng: -46.6333 }); // São Paulo default
  const [selectedPosition, setSelectedPosition] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [formData, setFormData] = useState<NovoLocal>({
    nome: '',
    latitude: 0,
    longitude: 0,
    raio: 100,
    cor: CORES_DISPONIVEIS[0].valor,
  });

  // Buscar locais
  const fetchLocais = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    const { data, error } = await supabase
      .from('locais')
      .select('*')
      .eq('user_id', user.id)
      .order('nome');

    if (error) {
      console.error('Erro ao buscar locais:', error);
    } else {
      setLocais(data || []);
      // Centralizar mapa no primeiro local
      if (data && data.length > 0) {
        setMapCenter({ lat: data[0].latitude, lng: data[0].longitude });
      }
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchLocais();
  }, [fetchLocais]);

  // Abrir modal para novo local
  const handleNovoLocal = () => {
    setEditando(null);
    setFormData({
      nome: '',
      latitude: mapCenter.lat,
      longitude: mapCenter.lng,
      raio: 100,
      cor: CORES_DISPONIVEIS[0].valor,
    });
    setSelectedPosition(null);
    setShowModal(true);
  };

  // Abrir modal para editar
  const handleEditar = (local: Local) => {
    setEditando(local);
    setFormData({
      nome: local.nome,
      latitude: local.latitude,
      longitude: local.longitude,
      raio: local.raio,
      cor: local.cor || CORES_DISPONIVEIS[0].valor,
    });
    setSelectedPosition({ lat: local.latitude, lng: local.longitude });
    setShowModal(true);
  };

  // Salvar local
  const handleSalvar = async () => {
    if (!user || !formData.nome.trim()) return;

    const dados = {
      user_id: user.id,
      nome: formData.nome.trim(),
      latitude: selectedPosition?.lat || formData.latitude,
      longitude: selectedPosition?.lng || formData.longitude,
      raio: formData.raio,
      cor: formData.cor,
      ativo: true,
    };

    if (editando) {
      // Atualizar
      const { error } = await supabase
        .from('locais')
        .update(dados)
        .eq('id', editando.id);

      if (error) {
        console.error('Erro ao atualizar:', error);
        alert('Erro ao atualizar local');
        return;
      }
    } else {
      // Criar
      const { error } = await supabase.from('locais').insert(dados);

      if (error) {
        console.error('Erro ao criar:', error);
        alert('Erro ao criar local');
        return;
      }
    }

    setShowModal(false);
    fetchLocais();
  };

  // Excluir local
  const handleExcluir = async (local: Local) => {
    if (!confirm(`Deseja excluir "${local.nome}"?`)) return;

    const { error } = await supabase.from('locais').delete().eq('id', local.id);

    if (error) {
      console.error('Erro ao excluir:', error);
      alert('Erro ao excluir local');
      return;
    }

    fetchLocais();
  };

  // Toggle ativo/inativo
  const handleToggleAtivo = async (local: Local) => {
    const { error } = await supabase
      .from('locais')
      .update({ ativo: !local.ativo })
      .eq('id', local.id);

    if (error) {
      console.error('Erro ao atualizar:', error);
      return;
    }

    fetchLocais();
  };

  // Simular clique no mapa (placeholder - integrar com Google Maps ou Leaflet)
  const handleMapClick = (lat: number, lng: number) => {
    setSelectedPosition({ lat, lng });
    setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Locais</h1>
          <p className="text-gray-500 mt-1">
            Gerencie seus locais de trabalho e geofences
          </p>
        </div>
        <button
          onClick={handleNovoLocal}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition"
        >
          <Plus className="w-4 h-4" />
          Novo Local
        </button>
      </div>

      {/* Layout com Mapa e Lista */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mapa */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Mapa</h3>
          </div>
          {/* Placeholder do Mapa - Integrar com Google Maps ou Leaflet */}
          <div className="h-96 bg-gray-100 flex items-center justify-center relative">
            <div className="text-center text-gray-500">
              <MapPin className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p className="font-medium">Mapa Interativo</p>
              <p className="text-sm mt-1">Clique para selecionar localização</p>
              <p className="text-xs mt-4 text-gray-400">
                Integrar com Google Maps ou Leaflet
              </p>
            </div>

            {/* Marcadores dos locais existentes */}
            {locais.map((local, index) => (
              <div
                key={local.id}
                className="absolute w-6 h-6 rounded-full border-2 border-white shadow-lg cursor-pointer transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  backgroundColor: local.cor || '#3B82F6',
                  // Posição simulada para demo
                  top: `${20 + index * 15}%`,
                  left: `${20 + index * 20}%`,
                }}
                title={local.nome}
              />
            ))}
          </div>

          {/* Coordenadas atuais */}
          <div className="p-4 bg-gray-50 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4" />
              <span>
                Centro: {mapCenter.lat.toFixed(6)}, {mapCenter.lng.toFixed(6)}
              </span>
            </div>
          </div>
        </div>

        {/* Lista de Locais */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">
              Seus Locais ({locais.length})
            </h3>
          </div>

          <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
              </div>
            ) : locais.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <MapPin className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Nenhum local cadastrado</p>
                <button
                  onClick={handleNovoLocal}
                  className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
                >
                  Adicionar primeiro local
                </button>
              </div>
            ) : (
              locais.map((local) => (
                <div
                  key={local.id}
                  className={`p-4 hover:bg-gray-50 transition ${!local.ativo ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Cor */}
                    <div
                      className="w-4 h-4 rounded-full mt-1 flex-shrink-0"
                      style={{ backgroundColor: local.cor || '#3B82F6' }}
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900">
                        {local.nome}
                      </h4>
                      <p className="text-sm text-gray-500 mt-1">
                        {local.latitude.toFixed(6)},{' '}
                        {local.longitude.toFixed(6)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Raio: {local.raio}m
                      </p>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleAtivo(local)}
                        className={`px-2 py-1 text-xs rounded-full ${
                          local.ativo
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {local.ativo ? 'Ativo' : 'Inativo'}
                      </button>
                      <button
                        onClick={() => handleEditar(local)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleExcluir(local)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal Novo/Editar Local */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900">
                {editando ? 'Editar Local' : 'Novo Local'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Local
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, nome: e.target.value }))
                  }
                  placeholder="Ex: Escritório, Obra Centro..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Coordenadas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={selectedPosition?.lat || formData.latitude}
                    onChange={(e) => {
                      const lat = parseFloat(e.target.value);
                      setFormData((prev) => ({ ...prev, latitude: lat }));
                      setSelectedPosition((prev) =>
                        prev
                          ? { ...prev, lat }
                          : { lat, lng: formData.longitude }
                      );
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={selectedPosition?.lng || formData.longitude}
                    onChange={(e) => {
                      const lng = parseFloat(e.target.value);
                      setFormData((prev) => ({ ...prev, longitude: lng }));
                      setSelectedPosition((prev) =>
                        prev
                          ? { ...prev, lng }
                          : { lat: formData.latitude, lng }
                      );
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              {/* Raio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Raio da Geofence (metros)
                </label>
                <input
                  type="number"
                  value={formData.raio}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      raio: parseInt(e.target.value) || 100,
                    }))
                  }
                  min={50}
                  max={1000}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Mínimo: 50m, Máximo: 1000m
                </p>
              </div>

              {/* Cor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cor do Marcador
                </label>
                <div className="flex flex-wrap gap-2">
                  {CORES_DISPONIVEIS.map((cor) => (
                    <button
                      key={cor.valor}
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, cor: cor.valor }))
                      }
                      className={`w-8 h-8 rounded-full border-2 transition ${
                        formData.cor === cor.valor
                          ? 'border-gray-900 scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: cor.valor }}
                      title={cor.nome}
                    />
                  ))}
                </div>
              </div>

              {/* Dica */}
              <div className="bg-blue-50 text-blue-700 px-4 py-3 rounded-lg text-sm">
                💡 No futuro, você poderá clicar no mapa para selecionar a
                localização automaticamente.
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                disabled={!formData.nome.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {editando ? 'Salvar Alterações' : 'Criar Local'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
