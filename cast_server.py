import socket
import threading
import time
from flask import Flask, send_from_directory
import pychromecast
from pychromecast.controllers.media import MediaController

# --- Configurações ---
FLASK_PORT = 8080
CAST_APP_ID = "CC1AD845" # ID do Receptor de Mídia Padrão

# --- Servidor Web (Flask) ---
app = Flask(__name__, static_folder='.', static_url_path='')

@app.route('/')
def serve_ranking_page():
    """ Rota principal que serve a página de visualização da TV. """
    return send_from_directory('.', 'tv-view.html')

def run_flask_app():
    """ Roda o servidor Flask em um host visível na rede. """
    # Usar '0.0.0.0' torna o servidor acessível por outros dispositivos na rede
    app.run(host='0.0.0.0', port=FLASK_PORT, debug=False)

# --- Funções Auxiliares ---
def get_local_ip():
    """ Descobre o endereço IP local do computador para construir a URL de casting. """
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Não precisa enviar dados, apenas conectar a um IP externo
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

# --- Lógica de Casting ---
def start_casting():
    """ Função principal para descobrir e controlar os dispositivos de casting. """
    print("Iniciando servidor web em segundo plano...")
    # Inicia o servidor Flask em uma thread separada para não bloquear o resto do script
    flask_thread = threading.Thread(target=run_flask_app, daemon=True)
    flask_thread.start()
    time.sleep(1) # Dá um segundo para o servidor iniciar

    local_ip = get_local_ip()
    ranking_url = f"http://{local_ip}:{FLASK_PORT}/"
    
    print("\nBuscando dispositivos de casting na sua rede... (pode levar alguns segundos)")
    
    # Descobre os Chromecasts na rede
    casts, browser = pychromecast.get_chromecasts()

    if not casts:
        print("\nNenhum dispositivo de casting (Chromecast, Google TV, etc.) foi encontrado.")
        print("Certifique-se de que o dispositivo está ligado e na mesma rede Wi-Fi.")
        browser.stop_discovery()
        return

    print("\n--- Dispositivos Encontrados ---")
    for i, cast in enumerate(casts):
        print(f"  [{i+1}] {cast.name} ({cast.cast_type})")

    print("---------------------------------\n")

    while True:
        try:
            choice_str = input("Digite o número do(s) dispositivo(s) para transmitir (separado por vírgula, ex: 1,3) ou 'all' para todos: ")
            if not choice_str:
                continue

            selected_indices = []
            if choice_str.lower() == 'all':
                selected_indices = list(range(len(casts)))
            else:
                selected_indices = [int(i.strip()) - 1 for i in choice_str.split(',')]

            # Valida a escolha do usuário
            if all(0 <= i < len(casts) for i in selected_indices):
                break
            else:
                print("Seleção inválida. Por favor, digite números da lista.")
        except ValueError:
            print("Entrada inválida. Por favor, digite apenas números separados por vírgula.")

    selected_casts = [casts[i] for i in selected_indices]

    print(f"\nTransmitindo o ranking para: {[cast.name for cast in selected_casts]}")
    print(f"URL: {ranking_url}\n")

    for cast in selected_casts:
        cast.wait() # Aguarda a conexão com o dispositivo
        
        # O 'mc' representa o controlador de mídia do dispositivo
        mc = cast.media_controller
        
        # Envia o comando para tocar a URL como um conteúdo de mídia
        mc.play_media(ranking_url, 'video/mp4', title='Ranking de Vendas', thumb=None)
        mc.block_until_active()
        print(f"Comando de casting enviado para '{cast.name}'.")

    # Impede que o script principal termine para manter o servidor Flask rodando
    print("\nO servidor de casting está ativo. Pressione Ctrl+C para encerrar.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nEncerrando o servidor e a descoberta de dispositivos...")
        browser.stop_discovery()
        print("Servidor encerrado.")

if __name__ == '__main__':
    start_casting()