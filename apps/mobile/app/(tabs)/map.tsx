import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, {
  Marker,
  Circle,
  PROVIDER_GOOGLE,
  MapPressEvent,
} from 'react-native-maps';
import {
  useLocationStore,
  type LocalDeTrabalho,
} from '../../src/stores/locationStore';
import {
  searchAddress,
  reverseGeocode,
  type GeocodingResult,
} from '../../src/lib/geocoding';
import { colors } from '../../src/constants/colors';
import { logger } from '../../src/lib/logger';
import { Button } from '../../src/components/ui/Button';

type AddLocationStep =
  | 'closed'
  | 'choose-method'
  | 'search'
  | 'pick-on-map'
  | 'confirm';

export default function MapScreen() {
  const {
    initialize,
    currentLocation,
    accuracy,
    refreshLocation,
    locais,
    addLocal,
    removeLocal,
    activeGeofence,
    isGeofencingActive,
    startGeofenceMonitoring,
    stopGeofenceMonitoring,
    hasPermission,
    hasBackgroundPermission,
  } = useLocationStore();

  const mapRef = useRef<MapView>(null);

  // Estado do fluxo de adicionar local
  const [addStep, setAddStep] = useState<AddLocationStep>('closed');
  const [newLocalName, setNewLocalName] = useState('');
  const [newLocalRaio, setNewLocalRaio] = useState('50');
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
  } | null>(null);

  // Busca de endereço
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Modo de seleção no mapa
  const [isPickingOnMap, setIsPickingOnMap] = useState(false);

  useEffect(() => {
    initialize();
  }, []);

  // Buscar endereço
  const handleSearch = async () => {
    if (searchQuery.length < 3) return;

    setIsSearching(true);
    try {
      const results = await searchAddress(searchQuery);
      setSearchResults(results);
    } catch (error) {
      logger.error('map', 'Search error', { error });
    } finally {
      setIsSearching(false);
    }
  };

  // Selecionar resultado da busca
  const selectSearchResult = (result: GeocodingResult) => {
    setSelectedLocation({
      latitude: result.latitude,
      longitude: result.longitude,
      address: result.address,
    });
    setSearchResults([]);
    setSearchQuery('');
    setAddStep('confirm');

    // Mover mapa para o local
    mapRef.current?.animateToRegion(
      {
        latitude: result.latitude,
        longitude: result.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      },
      500
    );
  };

  // Selecionar ponto no mapa (apenas quando em modo de seleção)
  const handleMapPress = async (event: MapPressEvent) => {
    // Só processar se está no modo de seleção no mapa
    if (!isPickingOnMap) return;

    const { latitude, longitude } = event.nativeEvent.coordinate;

    logger.info('map', 'Map pressed - selecting location', {
      latitude,
      longitude,
    });

    // Buscar endereço do ponto
    const address = await reverseGeocode(latitude, longitude);

    setSelectedLocation({
      latitude,
      longitude,
      address: address || undefined,
    });

    // Sair do modo de seleção e ir para confirmação
    setIsPickingOnMap(false);
    setAddStep('confirm');
  };

  // Usar localização atual
  const useCurrentLocation = () => {
    if (currentLocation) {
      setSelectedLocation({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      });
      setAddStep('confirm');
    } else {
      Alert.alert('Erro', 'Não foi possível obter sua localização atual.');
    }
  };

  // Iniciar modo de seleção no mapa
  const startPickOnMap = () => {
    setAddStep('pick-on-map');
    setIsPickingOnMap(true);
  };

  // Cancelar modo de seleção no mapa
  const cancelPickOnMap = () => {
    setIsPickingOnMap(false);
    setAddStep('choose-method');
  };

  // Abrir modal de adicionar
  const openAddModal = () => {
    setNewLocalName('');
    setNewLocalRaio('50');
    setSelectedLocation(null);
    setSearchQuery('');
    setSearchResults([]);
    setAddStep('choose-method');
  };

  // Fechar tudo
  const closeAddModal = () => {
    setAddStep('closed');
    setIsPickingOnMap(false);
    setSelectedLocation(null);
    setNewLocalName('');
    setSearchQuery('');
    setSearchResults([]);
  };

  // Salvar novo local
  const handleSaveLocal = () => {
    if (!newLocalName.trim()) {
      Alert.alert('Erro', 'Digite um nome para o local');
      return;
    }

    if (!selectedLocation) {
      Alert.alert('Erro', 'Selecione uma localização');
      return;
    }

    const raio = parseInt(newLocalRaio) || 50;

    addLocal({
      nome: newLocalName.trim(),
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      raio,
      cor: getRandomColor(),
      ativo: true,
    });

    closeAddModal();
    Alert.alert('Sucesso', 'Local adicionado!');
  };

  // Deletar local
  const handleDeleteLocal = (local: LocalDeTrabalho) => {
    Alert.alert('Remover Local', `Deseja remover "${local.nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => removeLocal(local.id),
      },
    ]);
  };

  const getRandomColor = () => {
    const colorsArr = [
      '#3B82F6',
      '#10B981',
      '#F59E0B',
      '#EF4444',
      '#8B5CF6',
      '#EC4899',
    ];
    return colorsArr[Math.floor(Math.random() * colorsArr.length)];
  };

  const activeLocal = locais.find((l) => l.id === activeGeofence);

  // Verificar se modal deve estar visível
  const isModalVisible = addStep !== 'closed' && addStep !== 'pick-on-map';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Mapa */}
      <View style={styles.mapContainer}>
        {currentLocation ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            showsUserLocation
            showsMyLocationButton
            onPress={handleMapPress}
            scrollEnabled={true}
            zoomEnabled={true}
            pitchEnabled={true}
            rotateEnabled={true}
          >
            {/* Círculos dos geofences */}
            {locais.map((local) => (
              <React.Fragment key={local.id}>
                <Circle
                  center={{
                    latitude: local.latitude,
                    longitude: local.longitude,
                  }}
                  radius={local.raio}
                  fillColor={`${local.cor}30`}
                  strokeColor={local.cor}
                  strokeWidth={2}
                />
                <Marker
                  coordinate={{
                    latitude: local.latitude,
                    longitude: local.longitude,
                  }}
                  title={local.nome}
                  description={`Raio: ${local.raio}m`}
                  pinColor={local.cor}
                />
              </React.Fragment>
            ))}

            {/* Marcador de seleção */}
            {selectedLocation && (
              <Marker
                coordinate={selectedLocation}
                pinColor="#FF6B6B"
                title="Local selecionado"
                draggable={isPickingOnMap}
                onDragEnd={(e) => {
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  setSelectedLocation((prev) =>
                    prev ? { ...prev, latitude, longitude } : null
                  );
                }}
              />
            )}
          </MapView>
        ) : (
          <View style={styles.loadingMap}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Carregando mapa...</Text>
          </View>
        )}

        {/* Status overlay */}
        {activeLocal && !isPickingOnMap && (
          <View style={styles.statusOverlay}>
            <Text style={styles.statusText}>
              🎯 Você está em: {activeLocal.nome}
            </Text>
          </View>
        )}

        {/* Overlay quando está selecionando no mapa */}
        {isPickingOnMap && (
          <>
            <View style={styles.pickingOverlay}>
              <Text style={styles.pickingText}>
                👆 Toque no mapa para selecionar o local
              </Text>
            </View>
            <TouchableOpacity
              style={styles.cancelPickButton}
              onPress={cancelPickOnMap}
            >
              <Text style={styles.cancelPickText}>✕ Cancelar</Text>
            </TouchableOpacity>
            {selectedLocation && (
              <TouchableOpacity
                style={styles.confirmPickButton}
                onPress={() => {
                  setIsPickingOnMap(false);
                  setAddStep('confirm');
                }}
              >
                <Text style={styles.confirmPickText}>✓ Confirmar Local</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* Painel inferior (escondido quando selecionando no mapa) */}
      {!isPickingOnMap && (
        <View style={styles.panel}>
          <ScrollView>
            {/* Locais */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  📍 Locais ({locais.length})
                </Text>
                <TouchableOpacity onPress={openAddModal}>
                  <Text style={styles.addButton}>+ Adicionar</Text>
                </TouchableOpacity>
              </View>

              {locais.length === 0 ? (
                <Text style={styles.emptyText}>Nenhum local cadastrado</Text>
              ) : (
                locais.map((local) => (
                  <View key={local.id} style={styles.localItem}>
                    <View
                      style={[styles.localDot, { backgroundColor: local.cor }]}
                    />
                    <View style={styles.localInfo}>
                      <Text style={styles.localName}>{local.nome}</Text>
                      <Text style={styles.localDetails}>
                        Raio: {local.raio}m
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteLocal(local)}>
                      <Text style={styles.deleteButton}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>

            {/* Monitoramento */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🔔 Monitoramento</Text>
              <Text style={styles.statusLabel}>
                Status: {isGeofencingActive ? '🟢 Ativo' : '⚫ Inativo'}
              </Text>

              <Button
                title={
                  isGeofencingActive ? '⏹️ Parar' : '▶️ Iniciar Monitoramento'
                }
                onPress={
                  isGeofencingActive
                    ? stopGeofenceMonitoring
                    : startGeofenceMonitoring
                }
                variant={isGeofencingActive ? 'secondary' : 'primary'}
                disabled={locais.length === 0}
              />
            </View>
          </ScrollView>
        </View>
      )}

      {/* Modal - Escolher Método */}
      <Modal
        visible={addStep === 'choose-method'}
        animationType="slide"
        transparent
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>📍 Adicionar Local</Text>
            <Text style={styles.modalSubtitle}>
              Como você quer definir o local?
            </Text>

            <TouchableOpacity
              style={styles.methodButton}
              onPress={useCurrentLocation}
            >
              <Text style={styles.methodIcon}>📍</Text>
              <View style={styles.methodInfo}>
                <Text style={styles.methodTitle}>Usar localização atual</Text>
                <Text style={styles.methodDesc}>Usar onde você está agora</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.methodButton}
              onPress={() => setAddStep('search')}
            >
              <Text style={styles.methodIcon}>🔍</Text>
              <View style={styles.methodInfo}>
                <Text style={styles.methodTitle}>Buscar por endereço</Text>
                <Text style={styles.methodDesc}>
                  Digite um endereço para buscar
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.methodButton}
              onPress={startPickOnMap}
            >
              <Text style={styles.methodIcon}>🗺️</Text>
              <View style={styles.methodInfo}>
                <Text style={styles.methodTitle}>Selecionar no mapa</Text>
                <Text style={styles.methodDesc}>
                  Toque no mapa para escolher
                </Text>
              </View>
            </TouchableOpacity>

            <Button
              title="Cancelar"
              onPress={closeAddModal}
              variant="outline"
              style={{ marginTop: 16 }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal - Buscar Endereço */}
      <Modal visible={addStep === 'search'} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🔍 Buscar Endereço</Text>

            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Digite o endereço..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                autoFocus
              />
              <TouchableOpacity
                style={styles.searchButton}
                onPress={handleSearch}
              >
                <Text style={styles.searchButtonText}>🔍</Text>
              </TouchableOpacity>
            </View>

            {isSearching && (
              <ActivityIndicator style={{ marginVertical: 20 }} />
            )}

            {searchResults.length > 0 && (
              <ScrollView style={styles.searchResults}>
                {searchResults.map((result, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.searchResultItem}
                    onPress={() => selectSearchResult(result)}
                  >
                    <Text style={styles.searchResultText} numberOfLines={2}>
                      📍 {result.address}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {searchQuery.length > 0 &&
              searchResults.length === 0 &&
              !isSearching && (
                <Text style={styles.noResultsText}>
                  Nenhum resultado. Tente outro termo.
                </Text>
              )}

            <Button
              title="← Voltar"
              onPress={() => setAddStep('choose-method')}
              variant="outline"
              style={{ marginTop: 16 }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal - Confirmar e Salvar */}
      <Modal visible={addStep === 'confirm'} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>✅ Confirmar Local</Text>

            {selectedLocation && (
              <View style={styles.selectedLocation}>
                <Text style={styles.selectedLocationLabel}>
                  Local selecionado:
                </Text>
                <Text style={styles.selectedLocationText}>
                  {selectedLocation.address ||
                    `${selectedLocation.latitude.toFixed(6)}, ${selectedLocation.longitude.toFixed(6)}`}
                </Text>
              </View>
            )}

            <TextInput
              style={styles.input}
              placeholder="Nome do local (ex: Escritório, Obra Centro)"
              value={newLocalName}
              onChangeText={setNewLocalName}
              autoFocus
            />

            <View style={styles.raioContainer}>
              <Text style={styles.raioLabel}>Raio de detecção (metros):</Text>
              <TextInput
                style={styles.raioInput}
                keyboardType="numeric"
                value={newLocalRaio}
                onChangeText={setNewLocalRaio}
              />
            </View>

            <Text style={styles.raioHint}>
              💡 Use 30-50m para locais pequenos, 100-200m para áreas maiores
            </Text>

            <View style={styles.modalButtons}>
              <Button
                title="← Voltar"
                onPress={() => setAddStep('choose-method')}
                variant="outline"
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="✓ Salvar"
                onPress={handleSaveLocal}
                style={{ flex: 1, marginLeft: 8 }}
                disabled={!newLocalName.trim() || !selectedLocation}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingMap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
  },
  loadingText: {
    marginTop: 12,
    color: colors.textSecondary,
  },
  statusOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: '#DCFCE7',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.success,
  },
  statusText: {
    color: colors.success,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Overlay quando está selecionando no mapa
  pickingOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 12,
  },
  pickingText: {
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 16,
  },
  cancelPickButton: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
  },
  cancelPickText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  confirmPickButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
  },
  confirmPickText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  panel: {
    maxHeight: '40%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  addButton: {
    color: colors.primary,
    fontWeight: '600',
  },
  emptyText: {
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  localItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  localDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  localInfo: {
    flex: 1,
  },
  localName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  localDetails: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  deleteButton: {
    fontSize: 18,
    padding: 4,
  },
  statusLabel: {
    color: colors.textSecondary,
    marginBottom: 12,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  // Botões de método
  methodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    marginBottom: 12,
  },
  methodIcon: {
    fontSize: 28,
    marginRight: 16,
  },
  methodInfo: {
    flex: 1,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  methodDesc: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  // Busca
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  searchButton: {
    marginLeft: 8,
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
  },
  searchButtonText: {
    fontSize: 18,
  },
  searchResults: {
    maxHeight: 200,
    marginBottom: 12,
  },
  searchResultItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchResultText: {
    fontSize: 14,
    color: colors.text,
  },
  noResultsText: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginVertical: 20,
  },
  // Local selecionado
  selectedLocation: {
    backgroundColor: colors.backgroundSecondary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  selectedLocationLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  selectedLocationText: {
    fontSize: 14,
    color: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  raioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  raioLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginRight: 12,
  },
  raioInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    width: 80,
    textAlign: 'center',
    fontSize: 16,
  },
  raioHint: {
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
  },
});
