// Inicializa Discord Components v4.0.2
try {
  await import('https://cdn.jsdelivr.net/npm/@skyra/discord-components-core@4.0.2/+esm');
  console.log('✅ Discord Components v4.0.2 carregados com sucesso!');
  
  // Dispara evento customizado para avisar que os componentes foram carregados
  window.dispatchEvent(new CustomEvent('discord-components-ready'));
} catch (error) {
  console.error('❌ Erro ao carregar Discord Components:', error);
}
