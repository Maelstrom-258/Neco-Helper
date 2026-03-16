const { ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getQuery, runQuery } = require('../../db/database');
const { replaceVariables } = require('../../utils/variables');

module.exports = {
    async execute(interaction, args) {
        const panelId = args[0];
        const panel = await getQuery(`SELECT * FROM ticket_panels WHERE id = ?`, [panelId]);

        if (!panel) return interaction.reply({ content: 'Este painel não existe mais.', ephemeral: true });

        const { cooldowns } = interaction.client;
        const cooldownAmount = (panel.cooldown || 60) * 1000;
        const key = `ticket_cooldown_${interaction.user.id}_${panelId}`;

        if (cooldowns.has(key)) {
            const expirationTime = cooldowns.get(key) + cooldownAmount;
            if (Date.now() < expirationTime) {
                const expiredTimestamp = Math.round(expirationTime / 1000);
                return interaction.reply({ content: `Por favor aguarde, você poderá criar outro ticket <t:${expiredTimestamp}:R>.`, ephemeral: true });
            }
        }

        await interaction.deferReply({ ephemeral: true });

        const dateNow = Math.floor(Date.now() / 1000);
        
        try {
            const res = await runQuery(
                `INSERT INTO tickets (guild_id, channel_id, panel_id, creator_id, created_at) VALUES (?, 'PENDING', ?, ?, ?)`,
                [interaction.guild.id, panel.id, interaction.user.id, dateNow]
            );
            
            const ticketId = res.lastID;
            
            const channelName = replaceVariables(panel.channel_name_format || 'dd-timecreated-username', { user: interaction.user, ticketId: ticketId }).slice(0, 100);

            let permissionOverwrites = [
                {
                    id: interaction.guild.id, 
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: interaction.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                },
                { 
                    id: interaction.client.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels],
                }
            ];

            if (panel.permissions && panel.permissions !== '[]') {
                try {
                    const roles = JSON.parse(panel.permissions);
                    roles.forEach(roleId => {
                         permissionOverwrites.push({
                             id: roleId,
                             allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                         });
                    });
                } catch(e) {}
            }

            const channelPayload = {
                name: channelName,
                type: ChannelType.GuildText,
                permissionOverwrites: permissionOverwrites
            };
            if (panel.category_id) {
                const cat = interaction.guild.channels.cache.get(panel.category_id);
                if (cat && cat.type === ChannelType.GuildCategory) {
                    channelPayload.parent = cat.id;
                }
            }

            const channel = await interaction.guild.channels.create(channelPayload);

            await runQuery(`UPDATE tickets SET channel_id = ? WHERE id = ?`, [channel.id, ticketId]);

            cooldowns.set(key, Date.now());
            setTimeout(() => cooldowns.delete(key), cooldownAmount);

            let initMessage = replaceVariables(panel.initial_message || `Olá {username}, a equipe irá te atender em breve!\nPara fechar o ticket digite /ticket fechar.`, { user: interaction.user, ticketId: ticketId });

            let embedsToSend = [];

            if (panel.initial_embed) {
                try {
                    const parsedEmbed = JSON.parse(panel.initial_embed);
                    
                    if (parsedEmbed.content && parsedEmbed.content.trim() !== '') {
                        initMessage = replaceVariables(parsedEmbed.content, { user: interaction.user, ticketId: ticketId });
                    }

                    // Process variables in the embed strings if they exist
                    if (parsedEmbed.embeds) {
                        embedsToSend = parsedEmbed.embeds.map(e => {
                            if (e.title) e.title = replaceVariables(e.title, { user: interaction.user, ticketId: ticketId });
                            if (e.description) e.description = replaceVariables(e.description, { user: interaction.user, ticketId: ticketId });
                            if (e.author && e.author.name) e.author.name = replaceVariables(e.author.name, { user: interaction.user, ticketId: ticketId });
                            if (e.footer && e.footer.text) e.footer.text = replaceVariables(e.footer.text, { user: interaction.user, ticketId: ticketId });
                            if (e.fields) {
                                e.fields = e.fields.map(f => {
                                    if (f.name) f.name = replaceVariables(f.name, { user: interaction.user, ticketId: ticketId });
                                    if (f.value) f.value = replaceVariables(f.value, { user: interaction.user, ticketId: ticketId });
                                    return f;
                                });
                            }
                            return e;
                        });
                    }
                } catch(e) {
                    console.error('Invalid initial_embed JSON', e);
                }
            }

            if (embedsToSend.length === 0) {
                 
                 embedsToSend = [
                     new EmbedBuilder().setDescription('Suporte iniciado. Aguarde um integrante da equipe responder ao seu ticket.').setColor(0xFFD700)
                 ];
            }

            await channel.send({ content: `<@${interaction.user.id}>\n${initMessage}`, embeds: embedsToSend });

            await interaction.editReply(`Seu ticket foi criado: <#${channel.id}>`);

        } catch (error) {
            console.error('Erro ao criar ticket: ', error);
            await interaction.editReply('Ocorreu um erro na criação do seu ticket. Verifique as permissões do bot.');
        }
    }
};
