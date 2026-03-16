const { REST, Routes } = require('discord.js');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`[START] Bot ${client.user.tag} está online!`);

        const commands = [];
        client.commands.forEach(cmd => {
            commands.push(cmd.data.toJSON());
        });

        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

        try {
            console.log(`[SLASH] Começando atualização de ${commands.length} comandos de barra.`);

            if (process.env.GUILD_ID) {
                await rest.put(
                    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                    { body: commands },
                );
                console.log(`[SLASH] Comandos atualizados com sucesso no servidor: ${process.env.GUILD_ID}`);
            } else {
                await rest.put(
                    Routes.applicationCommands(process.env.CLIENT_ID),
                    { body: commands },
                );
                console.log(`[SLASH] Comandos atualizados globalmente com sucesso.`);
            }
        } catch (error) {
            console.error(error);
        }

        const { allQuery, getQuery, runQuery } = require('../db/database');
        setInterval(async () => {
            try {
                const openTickets = await allQuery(`SELECT * FROM tickets WHERE status = 'open'`);
                const now = Math.floor(Date.now() / 1000);
                
                for (const ticket of openTickets) {
                    const panel = await getQuery(`SELECT lifetime, name FROM ticket_panels WHERE id = ?`, [ticket.panel_id]);
                    if (!panel || !panel.lifetime || panel.lifetime <= 0) continue; 

                    if (now - ticket.created_at >= panel.lifetime) {
                        
                        const channel = client.channels.cache.get(ticket.channel_id);
                        if (channel) {
                            try {
                                await channel.send({ content: `⏱️ Este ticket excedeu seu tempo de vida de ${panel.lifetime / 60} minutos e será fechado automaticamente em 1 minuto.` });
                                await runQuery(`UPDATE tickets SET status = 'closed_unsolved', closed_at = ? WHERE id = ?`, [now, ticket.id]);
                                
                                setTimeout(async () => {
                                    try {
                                        const ch = client.channels.cache.get(ticket.channel_id);
                                        if (ch) await ch.delete();
                                    } catch(e) {}
                                }, 60000);
                            } catch(e) {}
                        }
                    }
                }
            } catch(e) {
                console.error('Lifecycle Manager Error:', e);
            }
        }, 5 * 60 * 1000);
    },
};
