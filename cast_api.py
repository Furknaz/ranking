import socket
import threading
import time
from flask import Flask, jsonify, request, send_from_directory, Response # Adicionado Response para o proxy
import pychromecast
# ADIÇÃO JOTAMAKER AI: Importar o erro específico para melhor tratamento de conexão
from pychromecast.error import ChromecastConnectionError
from pychromecast.discovery import CastBrowser, SimpleCastListener
from uuid import UUID
import zeroconf
import requests # ADIÇÃO JOTAMAKER AI: Importar requests para o proxy

# --- Configurações ---
FLASK_PORT = 8080
NODE_API_URL = 'http://localhost:3000' # ADIÇÃO JOTAMAKER AI: URL do backend Node.js

# --- Servidor Web (Flask) e API de Casting ---
# CORREÇÃO JOTAMAKER AI: Ajustar static_folder e static_url_path para o diretório 'frontend'
app = Flask(__name__, static_folder='frontend', static_url_path='/frontend')

# Estrutura para armazenar os dispositivos encontrados
# ADIÇÃO JOTAMAKER AI: 'discovered_casts' agora armazenará apenas informações básicas do dispositivo
discovered_casts = {}
browser = None
zconf = None
listener = None # ADIÇÃO JOTAMAKER AI: 'listener' global para o CastBrowser

# CORREÇÃO JOTAMAKER AI: A função discovery_callback agora recebe 'name' (string)
# e simplesmente armazena as informações básicas. O objeto Chromecast completo
# será obtido de browser.devices.get(uuid) na função connect_to_cast.
def discovery_callback(uuid, name):
    """Callback para quando um dispositivo é encontrado ou atualizado."""
    discovered_casts[str(uuid)] = {'name': name, 'uuid': str(uuid)}
    print(f"Dispositivo encontrado/atualizado: {name} ({uuid})")

# ADIÇÃO JOTAMAKER AI: Função para remover dispositivos (limpeza)
def remove_callback(uuid, service_info_or_name): # service_info_or_name pode ser nome ou objeto
    """Callback para quando um dispositivo é removido."""
    if str(uuid) in discovered_casts:
        # Tenta obter o objeto Chromecast se ele estiver armazenado para desconectar
        cast_obj = None
        if browser and str(uuid) in browser.devices:
            cast_obj = browser.devices[str(uuid)]

        if cast_obj and cast_obj.is_connected:
            cast_obj.disconnect() # Tenta desconectar para liberar recursos
        
        del discovered_casts[str(uuid)]
        
        # Tenta obter um nome amigável para impressão
        friendly_name = ""
        if cast_obj and hasattr(cast_obj, 'device') and hasattr(cast_obj.device, 'friendly_name'):
            friendly_name = cast_obj.device.friendly_name
        elif isinstance(service_info_or_name, str):
            friendly_name = service_info_or_name # Se service_info_or_name era o nome da string

        print(f"Dispositivo removido: {friendly_name} ({uuid})")


def start_discovery():
    """Inicia a descoberta de dispositivos em segundo plano."""
    global browser, zconf, listener
    print("Iniciando a descoberta de dispositivos de casting...")

    # ADIÇÃO JOTAMAKER AI: Configurar o SimpleCastListener com os callbacks corretos
    listener = SimpleCastListener(add_callback=discovery_callback, update_callback=discovery_callback, remove_callback=remove_callback)
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

# CORREÇÃO JOTAMAKER AI: Rotas para servir páginas HTML da pasta 'frontend'
@app.route('/')
def serve_login_page():
    return send_from_directory(app.static_folder, 'login.html')

@app.route('/register.html')
def serve_register_page():
    return send_from_directory(app.static_folder, 'register.html')

@app.route('/ranking.html')
def serve_admin_page_protected():
    return send_from_directory(app.static_folder, 'ranking.html')

@app.route('/tv-view.html')
def serve_tv_page():
    return send_from_directory(app.static_folder, 'tv-view.html')

@app.route('/profile.html')
def serve_profile_page():
    return send_from_directory(app.static_folder, 'profile.html')

# ADIÇÃO JOTAMAKER AI: Rotas para servir arquivos CSS e JS da subpasta 'frontend/css' e 'frontend/js'
@app.route('/css/<path:filename>')
def serve_css(filename):
    return send_from_directory(f"{app.static_folder}/css", filename)

@app.route('/js/<path:filename>')
def serve_js(filename):
    return send_from_directory(f"{app.static_folder}/js", filename)


# ADIÇÃO JOTAMAKER AI: Endpoint de proxy para o backend Node.js
@app.route('/api/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
def proxy_api(path):
    """
    Atua como um proxy, encaminhando requisições da API para o servidor Node.js,
    agora com manipulação adequada de cookies de sessão.
    """
    node_url = f"{NODE_API_URL}/api/{path}"

    if request.method == 'OPTIONS':
        # Responde OK para requisições preflight OPTIONS (CORS)
        return Response(status=200)

    try:
        # Passa os cookies recebidos do cliente para a requisição ao backend Node.js
        resp = requests.request(
            method=request.method,
            url=node_url,
            headers={key: value for (key, value) in request.headers if key != 'Host'},
            data=request.get_data(),
            cookies=request.cookies, # CRUCIAL: Passa os cookies do cliente para o backend
            params=request.args,
            allow_redirects=False
        )

        excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
        headers = []
        for name, value in resp.raw.headers.items():
            if name.lower() not in excluded_headers:
                headers.append((name, value))

        response = Response(resp.content, resp.status_code, headers)

        # CRUCIAL: Retorna o cookie 'Set-Cookie' do backend para o cliente
        if 'Set-Cookie' in resp.headers:
            response.headers['Set-Cookie'] = resp.headers['Set-Cookie']

        return response

    except requests.exceptions.RequestException as e:
        print(f"FATAL: Não foi possível conectar ao backend Node.js em {node_url}. O servidor Node está rodando? Erro: {e}")
        error_message = {"status": "error", "message": "Erro de comunicação com o servidor principal da aplicação."}
        return jsonify(error_message), 502


# --- Endpoints da API ---
@app.route('/api/cast/devices', methods=['GET'])
def get_cast_devices(): # Renomeado para get_cast_devices para manter consistência com sua base
    """Endpoint da API para listar os dispositivos encontrados."""
    # ADIÇÃO JOTAMAKER AI: Retornar apenas os dados necessários do objeto Chromecast
    # Agora pega do 'discovered_casts' que é populado na discovery_callback
    return jsonify(list(discovered_casts.values()))

@app.route('/api/cast/connect', methods=['POST'])
def connect_to_cast(): # Renomeado para connect_to_cast para manter consistência com sua base
    """Endpoint da API para conectar e transmitir para os dispositivos selecionados."""
    data = request.get_json()
    device_uuids = data.get('devices')

    if not device_uuids:
        return jsonify({"status": "error", "message": "Nenhum dispositivo selecionado."}), 400

    local_ip = get_local_ip()
    # CORREÇÃO JOTAMAKER AI: Caminho para tv-view.html agora usa o prefixo /frontend
    ranking_url = f"http://{local_ip}:{FLASK_PORT}/frontend/tv-view.html"

    print(f"Recebido pedido para transmitir para: {device_uuids}")
    print(f"URL a ser transmitida: {ranking_url}")

    results = [] # ADIÇÃO JOTAMAKER AI: Para coletar resultados de cada transmissão
    try:
        for uuid_str in device_uuids:
            cast_uuid = UUID(uuid_str)
            # ADIÇÃO JOTAMAKER AI: Obter o objeto CastInfo diretamente de browser.devices
            device_info = browser.devices.get(cast_uuid)
            
            if device_info:
                print(f"Conectando a {device_info.friendly_name}...")
                # ADIÇÃO JOTAMAKER AI: Usar get_chromecast_from_cast_info com o objeto CastInfo
                cast_device = pychromecast.get_chromecast_from_cast_info(device_info, zconf)
                cast_device.wait()

                # Garante que qualquer app rodando seja parado antes de tentar tocar a mídia.
                print("Encerrando aplicativo atual na TV (se houver)...")
                cast_device.quit_app()
                time.sleep(2) # Pausa para garantir que o app foi encerrado

                print("Enviando URL para o Player de Mídia Padrão...")
                mc = cast_device.media_controller

                # CORREÇÃO JOTAMAKER AI: Usar 'text/html' para transmitir uma página web
                mc.play_media(ranking_url, 'text/html', title='Ranking de Vendas')
                # mc.block_until_active() # ADIÇÃO JOTAMAKER AI: Pode ser útil para esperar a mídia carregar

                print(f"Comando de transmissão enviado com sucesso para: {device_info.friendly_name}")
                results.append({"uuid": uuid_str, "status": "success", "message": f"Transmitido para {device_info.friendly_name}"})
            else:
                print(f"Dispositivo com UUID {uuid_str} não encontrado na lista atual.")
                results.append({"uuid": uuid_str, "status": "error", "message": f"Dispositivo {uuid_str} não encontrado na lista atual."})

        return jsonify(results) # ADIÇÃO JOTAMAKER AI: Retornar todos os resultados

    # ADIÇÃO JOTAMAKER AI: Tratamento de erro específico para problemas de conexão com o Chromecast
    except ChromecastConnectionError as e:
        print(f"Erro de conexão com o Chromecast durante a transmissão: {e}")
        return jsonify({"status": "error", "message": f"Erro de conexão com o Chromecast: {str(e)}"}), 500
    except Exception as e:
        print(f"Erro genérico durante a transmissão: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == '__main__':
    start_discovery()

    ip_address = get_local_ip()
    print("\n--- Servidor da Aplicação de Ranking Iniciado ---")
    print("Abra seu navegador e acesse a interface de administração:")
    # CORREÇÃO JOTAMAKER AI: A URL de entrada agora aponta para /frontend/login.html
    print(f"http://{ip_address}:{FLASK_PORT}/frontend/login.html")
    print("--------------------------------------------------\n")

    try:
        app.run(host='0.0.0.0', port=FLASK_PORT, debug=False)
    except KeyboardInterrupt:
        print("\nEncerrando...")
    finally:
        stop_discovery()