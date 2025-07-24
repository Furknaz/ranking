// backend/services/notificationService.js

// --- INÍCIO DA ADIÇÃO (DevRank AI): Importar a biblioteca Twilio ---
const twilio = require('twilio');
// --- FIM DA ADIÇÃO (DevRank AI) ---

const axios = require('axios'); // Mantém axios caso precise de outras APIs no futuro ou para referência

/**
 * @file Serviço de Notificação
 * @description Módulo responsável por enviar notificações para um endpoint externo, agora com suporte Twilio.
 */

class NotificationService {
    constructor() {
        // --- INÍCIO DA ADIÇÃO (DevRank AI): Configurações do Twilio ---
        this.accountSid = process.env.TWILIO_ACCOUNT_SID;
        this.authToken = process.env.TWILIO_AUTH_TOKEN;
        this.twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER; // Seu número Twilio (ex: '+1234567890' ou 'whatsapp:+1234567890')
        this.recipientPhoneNumber = process.env.TWILIO_RECIPIENT_NUMBER; // Número para onde a notificação será enviada

        if (this.accountSid && this.authToken) {
            this.twilioClient = twilio(this.accountSid, this.authToken);
            console.log('Twilio client inicializado.');
        } else {
            console.warn('⚠️ ATENÇÃO: Credenciais Twilio (TWILIO_ACCOUNT_SID ou TWILIO_AUTH_TOKEN) não configuradas. O envio de mensagens via Twilio estará desabilitado.');
        }
        if (!this.twilioPhoneNumber) {
            console.warn('⚠️ ATENÇÃO: Número de telefone Twilio (TWILIO_PHONE_NUMBER) não configurado. O envio de mensagens via Twilio estará desabilitado.');
        }
        if (!this.recipientPhoneNumber) {
            console.warn('⚠️ ATENÇÃO: Número do destinatário Twilio (TWILIO_RECIPIENT_NUMBER) não configurado. O envio de mensagens via Twilio estará desabilitado.');
        }
        // --- FIM DA ADIÇÃO (DevRank AI) ---

        // A URL do serviço de notificação externo para a implementação anterior (mantida para referência)
        this.notificationApiUrl = process.env.NOTIFICATION_API_URL;
        if (this.notificationApiUrl) {
            console.log('Usando NOTIFICATION_API_URL para notificações genéricas. Twilio será prioritário se configurado.');
        }
    }

    /**
     * Envia uma notificação de nova venda. Prioriza Twilio se configurado, caso contrário, tenta a API genérica.
     * @param {object} saleDetails - Detalhes da venda para enviar na notificação.
     * @param {string} saleDetails.sellerName - Nome do vendedor que realizou a venda.
     * @param {number} saleDetails.saleValue - Valor da venda.
     */
    async sendNewSaleNotification(saleDetails) {
        const { sellerName, saleValue } = saleDetails;
        const formattedValue = saleValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const message = `🎉 Nova Venda Registrada! 🎉\nVendedor: ${sellerName}\nValor: ${formattedValue}`;

        // --- INÍCIO DA ADIÇÃO (DevRank AI): Lógica de envio com Twilio ---
        if (this.twilioClient && this.twilioPhoneNumber && this.recipientPhoneNumber) {
            try {
                console.log(`Attempting to send Twilio message to ${this.recipientPhoneNumber} from ${this.twilioPhoneNumber}...`);
                const result = await this.twilioClient.messages.create({
                    body: message,
                    to: this.recipientPhoneNumber,
                    from: this.twilioPhoneNumber
                });
                console.log('✅ Mensagem Twilio enviada com sucesso! SID:', result.sid);
                return; // Notificação enviada via Twilio, não precisamos tentar a API genérica
            } catch (error) {
                console.error('❌ Erro ao enviar mensagem via Twilio:', error.message);
                if (error.code) { // Códigos de erro específicos do Twilio
                    console.error('Código de erro Twilio:', error.code);
                    console.error('Mais info:', error.moreInfo);
                }
                // Continua para a API genérica se Twilio falhar ou não estiver configurado
            }
        }
        // --- FIM DA ADIÇÃO (DevRank AI) ---

        // Fallback para a API de notificação genérica, se Twilio não estiver configurado ou falhar
        if (this.notificationApiUrl) {
            try {
                console.log(`Attempting to send generic notification to: ${this.notificationApiUrl}`);
                const response = await axios.post(this.notificationApiUrl, {
                    text: message
                });
                console.log('✅ Notificação genérica enviada com sucesso:', response.status);
            } catch (error) {
                console.error('❌ Erro ao enviar notificação genérica:', error.message);
                if (error.response) {
                    console.error('Detalhes do erro da API de notificação:', error.response.data);
                }
            }
        } else {
            console.log('Nenhum serviço de notificação configurado (Twilio ou API genérica). Notificação não enviada.');
        }
    }
}

module.exports = new NotificationService();