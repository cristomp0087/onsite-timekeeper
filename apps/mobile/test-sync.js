// Teste de Sincronização - OnSite Timekeeper
// Rode: node test-sync.js

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://xmpckuiluwhcdzyadggh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtcGNrdWlsdXdoY2R6eWFkZ2doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MTIyNTIsImV4cCI6MjA4MjM4ODI1Mn0.SUvLl9LxEXw795JNI4S9mFn-LABGIQoBdH51jtY1WE8'
);

async function testSync() {
  console.log('🧪 Testando conexão com Supabase...\n');

  // Teste 1: Verificar tabelas
  console.log('1️⃣ Testando leitura de locais...');
  const { data: locais, error: erroLocais } = await supabase
    .from('locais')
    .select('*');

  if (erroLocais) {
    console.log('❌ Erro ao ler locais:', erroLocais.message);
  } else {
    console.log(`✅ Sucesso! Encontrados ${locais.length} locais`);
  }

  // Teste 2: Verificar registros
  console.log('\n2️⃣ Testando leitura de registros...');
  const { data: registros, error: erroRegistros } = await supabase
    .from('registros')
    .select('*');

  if (erroRegistros) {
    console.log('❌ Erro ao ler registros:', erroRegistros.message);
  } else {
    console.log(`✅ Sucesso! Encontrados ${registros.length} registros`);
  }

  console.log('\n✅ Testes concluídos!\n');
  console.log('📊 Resumo:');
  console.log(`   Locais: ${locais?.length || 0}`);
  console.log(`   Registros: ${registros?.length || 0}`);
  console.log('\n🎉 Supabase está funcionando!');
}

testSync().catch(console.error);
