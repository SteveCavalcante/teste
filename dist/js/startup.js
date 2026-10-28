/** Keep initialization errors visible even when another script fails to load. */
(() => {
    let failed = false;
    const show = (message, error) => {
        const status = document.getElementById('applicationStatus');
        if (!status) return;
        status.textContent = message;
        status.className = error ? 'application-status error' : 'application-status';
    };
    window.portalStartup = {
        ready() {
            if (!failed) show('Roteirizou! v61 pronto.', false);
        },
        fail(message) {
            failed = true;
            show('Falha no Roteirizou! v61: ' + message + ' Recarregue a página. Se continuar, informe esta mensagem ao suporte. Seus dados não foram apagados.', true);
        },
    };
    window.addEventListener('error', event => {
        const target = event.target;
        if (target?.tagName === 'SCRIPT') {
            const file = String(target.src || '').split('/').pop().split('?')[0];
            window.portalStartup.fail('o arquivo ' + file + ' não carregou.');
        } else if (event.message) window.portalStartup.fail(event.message);
    }, true);
    window.addEventListener('unhandledrejection', event => {
        window.portalStartup.fail(event.reason?.message || 'uma operação não foi concluída.');
    });
})();
