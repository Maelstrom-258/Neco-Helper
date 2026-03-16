const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, AttachmentBuilder } = require('discord.js');
const { runQuery, allQuery, getQuery } = require('../db/database');
const { cleanEmpty } = require('../utils/json_cleaner');
const path = require('path');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Sistema principal de Tickets')
        
        .addSubcommand(sub =>
            sub.setName('novo')
                .setDescription('[Admin] Cria um novo painel de ticket')
                .addStringOption(opt => opt.setName('nome').setDescription('Nome único identificador').setRequired(true))
                .addChannelOption(opt => opt.setName('canal').setDescription('Canal de envio').addChannelTypes(ChannelType.GuildText))
                .addAttachmentOption(opt => opt.setName('embed_json').setDescription('Arquivo .json para criar uma embed customizada'))
        )
        .addSubcommand(sub =>
            sub.setName('editar')
                .setDescription('[Admin] Edita configurações de um painel de ticket existente')
        )
        .addSubcommand(sub =>
            sub.setName('apagar')
                .setDescription('[Admin] Apaga um painel de ticket')
        )
        .addSubcommand(sub =>
            sub.setName('historico')
                .setDescription('[Admin] Ver histórico de tickets')
                .addStringOption(opt => opt.setName('filtro').setDescription('Status').addChoices(
                    { name: 'Abertos', value: 'open' },
                    { name: 'Fechados (Resolvidos)', value: 'closed_solved' },
                    { name: 'Fechados (Não Resolvidos)', value: 'closed_unsolved' }
                ))
                .addStringOption(opt => opt.setName('painel').setDescription('Filtrar por painel específico').setAutocomplete(true))
        )
        
        .addSubcommand(sub =>
            sub.setName('abrir')
                .setDescription('Abre um novo ticket a partir de um dos painéis disponíveis')
                .addStringOption(opt => opt.setName('id').setDescription('Escolha qual painel deseja abrir').setRequired(true).setAutocomplete(true))
        )
        .addSubcommand(sub =>
            sub.setName('fechar')
                .setDescription('Fecha o ticket atual')
        )
        .addSubcommand(sub =>
            sub.setName('transcrever')
                .setDescription('Gera um arquivo com mensagens deste ticket e te envia na DM')
        )
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('Mostra estatísticas de tickets')
        ),

    async autocomplete(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const focusedValue = interaction.options.getFocused();
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        if (subcommand === 'abrir' || (subcommand === 'historico' && isAdmin)) {
            
            const panels = await allQuery(`SELECT id, name, hide_from_users FROM ticket_panels WHERE guild_id = ?`, [interaction.guild.id]);

            let choices = panels;

            if (!isAdmin && subcommand === 'abrir') {
                choices = choices.filter(p => p.hide_from_users !== 1);
            }

            choices = choices.map(p => ({ name: p.name, value: p.id.toString() }));

            if (focusedValue) choices = choices.filter(choice => choice.name.toLowerCase().includes(focusedValue.toLowerCase()));

            await interaction.respond(choices.slice(0, 25));
        }
    },

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        if (['novo', 'editar', 'apagar', 'historico'].includes(subcommand) && !isAdmin) {
            return interaction.reply({ content: 'Você não tem permissão para usar este comando de administrador.', ephemeral: true });
        }

        switch (subcommand) {
            case 'novo': return this.handleNovo(interaction);
            case 'editar': return this.handleEditar(interaction);
            case 'apagar': return this.handleApagar(interaction);
            case 'historico': return this.handleHistorico(interaction);
            case 'abrir': return this.handleAbrir(interaction);
            case 'fechar': return this.handleFechar(interaction);
            case 'transcrever': return this.handleTranscrever(interaction);
            case 'status': return this.handleStatus(interaction);
        }
    },

    async handleNovo(interaction) {
        const name = interaction.options.getString('nome');
        const channel = interaction.options.getChannel('canal') || interaction.channel;
        const attachment = interaction.options.getAttachment('embed_json');

        let embedData = { embeds: [{ title: `Ticket: ${name}`, description: 'Clique no botão abaixo para abrir um ticket!', color: 0xFFD700 }] };

        if (attachment && attachment.name.endsWith('.json')) {
            try {
                const response = await fetch(attachment.url);
                const jsonRaw = await response.json();
                embedData = cleanEmpty(jsonRaw);
                if (!embedData.embeds && !embedData.content) {
                    throw new Error("Invalid json format");
                }
            } catch (e) {
                return interaction.reply({ content: 'Erro ao analisar o JSON do painel. Arquivo malformado.', ephemeral: true });
            }
        }

        let panelId;
        try {
            const res = await runQuery(`INSERT INTO ticket_panels (guild_id, channel_id, name) VALUES (?, ?, ?)`, [interaction.guild.id, channel.id, name]);
            panelId = res.lastID;
        } catch (e) {
            return interaction.reply({ content: 'Ocorreu um erro no banco de dados ao inicializar o painel.', ephemeral: true });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`createTicket_${panelId}`).setLabel('Criar Ticket').setStyle(ButtonStyle.Primary).setEmoji('🎫')
        );

        let msgPayload = { components: [row] };

        if (embedData.content) msgPayload.content = embedData.content;
        if (embedData.embeds) {
            msgPayload.embeds = embedData.embeds.map(e => {
                if (!e.color) e.color = 0xFFD700;
                return e;
            });
        }

        try {
            const msg = await channel.send(msgPayload);
            await runQuery(`UPDATE ticket_panels SET message_id = ? WHERE id = ?`, [msg.id, panelId]);
            await interaction.reply({ content: `Painel criado com sucesso em <#${channel.id}>! ID: ${panelId}`, ephemeral: true });
        } catch (error) {
            console.error('Send error:', error);
            await runQuery(`DELETE FROM ticket_panels WHERE id = ?`, [panelId]);

            const fallbackRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`forcePanel_${name}_${channel.id}`).setLabel('Usar Padrão').setStyle(ButtonStyle.Danger)
            );
            await interaction.reply({
                content: 'O Discord não aceitou a estrutura do seu Embed! Pode haver campos vazios ou formatos errados.\nDeseja forçar a criação com o visual padrão amarelinho?',
                ephemeral: true,
                components: [fallbackRow]
            });
        }
    },

    async handleEditar(interaction) {
        const panels = await allQuery(`SELECT * FROM ticket_panels WHERE guild_id = ?`, [interaction.guild.id]);
        if (panels.length === 0) return interaction.reply({ content: 'Não há botões criados neste servidor. Use `/ticket novo` primeiro.', ephemeral: true });

        const options = panels.map(p => ({ label: p.name, description: `No canal #${p.channel_id}`, value: p.id.toString(), emoji: '🎫' })).slice(0, 25);
        const embed = new EmbedBuilder().setTitle('🔧 Editar Painel').setDescription('Selecione abaixo o painel que você deseja editar.').setColor(0xFFD700);
        const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('editPanelMenu_select').setPlaceholder('Selecione um painel...').addOptions(options));

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    },

    async handleApagar(interaction) {
        const panels = await allQuery(`SELECT * FROM ticket_panels WHERE guild_id = ?`, [interaction.guild.id]);
        if (panels.length === 0) return interaction.reply({ content: 'Não há painéis de tickets.', ephemeral: true });

        const options = panels.map(p => ({ label: p.name, description: `#${p.channel_id}`, value: p.id.toString(), emoji: '🗑️' })).slice(0, 25);
        const embed = new EmbedBuilder().setTitle('🗑️ Apagar Painel').setDescription('O painel não funcionará mais e sumirá deste menu.').setColor(0xFFD700);
        const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('deletePanelMenu_select').setPlaceholder('Selecione...').addOptions(options));

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    },

    async handleHistorico(interaction) {
        const filter = interaction.options.getString('filtro');
        const painelInput = interaction.options.getString('painel'); 

        let query = `SELECT * FROM tickets WHERE guild_id = ?`;
        let params = [interaction.guild.id];

        if (filter) { query += ` AND status = ?`; params.push(filter); }
        if (painelInput) { query += ` AND panel_id = ?`; params.push(painelInput); }

        query += ` ORDER BY created_at DESC`;

        const tickets = await allQuery(query, params);
        if (tickets.length === 0) return interaction.reply({ content: 'Nenhum ticket encontrado para estes filtros.', ephemeral: true });

        const itemsPerPage = 8;
        const totalPages = Math.ceil(tickets.length / itemsPerPage);
        let currentPage = 1;

        const generateEmbed = (page) => {
            const start = (page - 1) * itemsPerPage;
            const currentTickets = tickets.slice(start, start + itemsPerPage);

            const embed = new EmbedBuilder().setTitle(`📖 Histórico de Tickets (${page}/${totalPages})`).setColor(0xFFD700);
            let desc = '';
            for (const t of currentTickets) {
                const statusDisplay = t.status === 'open' ? '🟢 Aberto' : (t.status === 'closed_solved' ? '✅ Resolvido' : '❌ Não Resolvido');
                desc += `**T #${t.id} \u2014 <@${t.creator_id}>**\n» ${statusDisplay} | ⏰ <t:${t.created_at}:f>\n`;
            }
            embed.setDescription(desc);
            return embed;
        };

        const generateButtons = (page) => {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`histPage_prev`).setLabel('◀').setStyle(ButtonStyle.Primary).setDisabled(page === 1),
                new ButtonBuilder().setCustomId(`histPage_next`).setLabel('▶').setStyle(ButtonStyle.Primary).setDisabled(page === totalPages)
            );
        };

        const response = await interaction.reply({
            embeds: [generateEmbed(currentPage)],
            components: totalPages > 1 ? [generateButtons(currentPage)] : [],
            ephemeral: true,
            fetchReply: true
        });

        if (totalPages > 1) {
            const collector = response.createMessageComponentCollector({ time: 120000 });
            collector.on('collect', async i => {
                if (i.customId === 'histPage_prev') currentPage--;
                else if (i.customId === 'histPage_next') currentPage++;
                await i.update({ embeds: [generateEmbed(currentPage)], components: [generateButtons(currentPage)] });
            });
            collector.on('end', () => {
                interaction.editReply({ components: [] }).catch(() => { });
            });
        }
    },

    async handleAbrir(interaction) {
        const panelId = interaction.options.getString('id');

        const handler = require('../interactions/buttons/createTicket.js');
        
        await handler.execute(interaction, [panelId]);
    },

    async handleFechar(interaction) {
        const ticket = await getQuery(`SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'`, [interaction.channel.id]);
        if (!ticket) return interaction.reply({ content: 'Use dentro de um ticket aberto.', ephemeral: true });

        const panel = await getQuery(`SELECT * FROM ticket_panels WHERE id = ?`, [ticket.panel_id]);
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        if (panel && panel.user_can_close === 0 && !isAdmin) {
            const embed = new EmbedBuilder().setTitle('Solicitação').setDescription('O criador quer fechar. Equipe pode aprovar se quiser, nya.').setColor(0xFFD700);
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`closeTicket_true_${ticket.id}`).setLabel('Encerrar Nyatendimento?').setStyle(ButtonStyle.Danger));
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        const closeEmbed = new EmbedBuilder().setTitle('🔒 Fechando').setDescription('Em 1 minuto...').setColor(0xFFD700);
        await interaction.reply({ embeds: [closeEmbed] });

        if (panel && panel.feedback_enabled) {
            try {
                const userObj = await interaction.client.users.fetch(ticket.creator_id);
                const fbEmbed = new EmbedBuilder().setTitle('Feedback').setDescription('Seu problema foi resolvido?').setColor(0xFFD700);
                const fRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`feedbackYes_${ticket.id}`).setLabel('Sim').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`feedbackNo_${ticket.id}`).setLabel('Não').setStyle(ButtonStyle.Danger)
                );
                await userObj.send({ embeds: [fbEmbed], components: [fRow] }).catch(() => { });
            } catch (e) { }
        } else {
            await runQuery(`UPDATE tickets SET status = 'closed_solved', closed_at = ? WHERE id = ?`, [Math.floor(Date.now() / 1000), ticket.id]);
        }

        setTimeout(async () => {
            try { await interaction.channel.delete(); } catch (e) { }
        }, 60000);
    },

    async handleTranscrever(interaction) {
        const ticket = await getQuery(`SELECT id FROM tickets WHERE channel_id = ?`, [interaction.channel.id]);
        if (!ticket) return interaction.reply({ content: 'Apenas tickets.', ephemeral: true });

        await interaction.deferReply({ ephemeral: true });
        const messages = [];
        let lastId;
        while (true) {
            const opts = { limit: 100 }; if (lastId) opts.before = lastId;
            const fetched = await interaction.channel.messages.fetch(opts);
            if (fetched.size === 0) break;
            fetched.forEach(msg => messages.push(msg));
            lastId = fetched.last().id;
        }
        messages.reverse();

        let text = `Transcrição #${ticket.id}\n============\n\n`;
        for (const msg of messages) text += `[${new Date(msg.createdTimestamp).toLocaleString()}] ${msg.author.tag}: ${msg.content}\n`;

        const filePath = path.join(__dirname, `transcript-${ticket.id}.txt`);
        fs.writeFileSync(filePath, text, 'utf-8');
        const attachment = new AttachmentBuilder(filePath);

        try {
            await interaction.user.send({ content: 'Sua transcrição.', files: [attachment] });
            await interaction.editReply('Enviado DM!');
        } catch (e) {
            await interaction.editReply({ content: 'DM fechada! Pegue o arquivo aqui:', files: [attachment] });
        }

        setTimeout(() => { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); }, 5000);
    },

    async handleStatus(interaction) {
        const ticket = await getQuery(`SELECT * FROM tickets WHERE channel_id = ?`, [interaction.channel.id]);
        if (ticket) {
            const creator = await interaction.client.users.fetch(ticket.creator_id).catch(() => null);
            const messages = await interaction.channel.messages.fetch({ limit: 100 }).catch(() => null);
            const userMsgs = messages ? messages.filter(m => m.author.id === ticket.creator_id).size : 0;
            const embed = new EmbedBuilder().setTitle('📊 Status Local').setColor(0xFFD700)
                .addFields(
                    { name: 'Criador', value: creator ? `${creator.tag}` : 'N/A', inline: true },
                    { name: 'Criado', value: `<t:${ticket.created_at}:R>`, inline: true },
                    { name: 'Total Msgs/Criador Msgs (100+)', value: `${messages ? messages.size : 0} / ${userMsgs}`, inline: false }
                );
            return interaction.reply({ embeds: [embed] });
        } else {
            const tickets = await allQuery(`SELECT status FROM tickets WHERE guild_id = ?`, [interaction.guild.id]);
            const o = tickets.filter(t => t.status === 'open').length;
            const s = tickets.filter(t => t.status === 'closed_solved').length;
            const u = tickets.filter(t => t.status === 'closed_unsolved').length;
            const embed = new EmbedBuilder().setTitle('📊 Status Global').setColor(0xFFD700)
                .addFields(
                    { name: 'Total', value: String(tickets.length), inline: true },
                    { name: 'Abertos', value: String(o), inline: true },
                    { name: 'Resolvidos/Não Resolvidos', value: `${s}/${u}`, inline: false }
                );
            return interaction.reply({ embeds: [embed] });
        }
    }
};
