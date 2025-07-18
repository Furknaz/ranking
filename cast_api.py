import socket
import threading
import time
from flask import Flask, jsonify, request, send_from_directory
import pychromecast
from pychromecast.discovery import CastBrowser, SimpleCastListener
from uuid import UUID
import zeroconf

# --- Configurações ---
FLASK_PORT = 8080

# --- Servidor Web (Flask) e API de Casting ---
app = Flask(__name__, static_folder='.', static_url_path='')

# Estrutura para armazenar os dispositivos encontrados
discovered_casts = {}
browser = None
zconf = None

def discovery_callback(uuid, name):
    """Callback para quando um dispositivo é encontrado ou atualizado."""
    discovered_casts[str(uuid)] = {'name': name, 'uuid': str(uuid)}
    print(f"Dispositivo encontrado/atualizado: {name} ({uuid})")

def start_discovery():
    """Inicia a descoberta de dispositivos em segundo plano."""
    global browser, zconf
    print("Iniciando a descoberta de dispositivos de casting...")
    
    listener = SimpleCastListener(add_callback=discovery_callback, update_callback=discovery_callback)
    zconf = zeroconf.Zeroconf()
    browser = CastBrowser(listener, zconf)
    
    browser.start_discovery()

def stop_discovery():
    """Para a descoberta de dispositivos."""
    if browser:
        print("Parando a descoberta de dispositivos...")
        browser.stop_discovery()
        if zconf:
            zconf.close()

def get_local_ip():
    """Descobre o endereço IP local do computador."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

@app.route('/')
def serve_admin_page():
    """Serve a página principal de administração."""
    return send_from_directory('.', 'ranking.html')

@app.route('/tv-view.html')
def serve_tv_page():
    """Serve a página de visualização da TV."""
    return send_from_directory('.', 'tv-view.html')

# --- Endpoints da API ---
@app.route('/api/cast/devices', methods=['GET'])
def get_cast_devices():
    """Endpoint da API para listar os dispositivos encontrados."""
    return jsonify(list(discovered_casts.values()))

@app.route('/api/cast/connect', methods=['POST'])
def connect_to_cast():
    """Endpoint da API para conectar e transmitir para os dispositivos selecionados."""
    data = request.get_json()
    device_uuids = data.get('devices')

    if not device_uuids:
        return jsonify({"status": "error", "message": "Nenhum dispositivo selecionado."}), 400

    local_ip = get_local_ip()
    ranking_url = f"http://{local_ip}:{FLASK_PORT}/tv-view.html"
    
    print(f"Recebido pedido para transmitir para: {device_uuids}")
    print(f"URL a ser transmitida: {ranking_url}")

    try:
        for uuid_str in device_uuids:
            cast_uuid = UUID(uuid_str)
            device_info = browser.devices.get(cast_uuid)
            
            if device_info:
                print(f"Conectando a {device_info.friendly_name}...")
                cast_device = pychromecast.get_chromecast_from_cast_info(device_info, zconf)
                cast_device.wait()

                # --- INÍCIO DA CORREÇÃO ---
                # Garante que qualquer app rodando seja parado antes de tentar tocar a mídia.
                # Isso "limpa" o estado da TV.
                print("Encerrando aplicativo atual na TV (se houver)...")
                cast_device.quit_app()
                time.sleep(2) # Pausa para garantir que o app foi encerrado

                print("Enviando URL para o Player de Mídia Padrão...")
                mc = cast_device.media_controller
                
                # Tenta tocar a URL como um tipo de mídia genérico.
                # Muitos dispositivos modernos conseguem renderizar uma página web simples desta forma.
                mc.play_media(ranking_url, 'video/mp4', title='Ranking de Vendas')
                # --- FIM DA CORREÇÃO ---

                print(f"Comando de transmissão enviado com sucesso para: {device_info.friendly_name}")
            else:
                print(f"Dispositivo com UUID {uuid_str} não encontrado na lista atual.")

        return jsonify({"status": "success", "message": "Comando de transmissão enviado!"})

    except Exception as e:
        print(f"Erro durante a transmissão: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == '__main__':
    start_discovery()
    
    ip_address = get_local_ip()
    print("\n--- Servidor da Aplicação de Ranking Iniciado ---")
    print("Abra seu navegador e acesse a interface de administração:")
    print(f"http://{ip_address}:{FLASK_PORT}")
    print("--------------------------------------------------\n")

    try:
        app.run(host='0.0.0.0', port=FLASK_PORT, debug=False)
    except KeyboardInterrupt:
        print("\nEncerrando...")
    finally:
        stop_discovery()