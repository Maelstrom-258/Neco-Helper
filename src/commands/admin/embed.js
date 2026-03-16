const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { runQuery, getQuery, allQuery } = require('../../db/database');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('[Admin] Gerenciar e criar embeds através de um assistente interativo')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => 
            sub.setName('novo')
                .setDescription('Cria um novo embed através de um assistente (wizard)')
        )
        .addSubcommand(sub => 
            sub.setName('postar')
                .setDescription('Posta um embed salvo no canal atual ou no canal especificado')
                .addStringOption(opt => opt.setName('nome').setDescription('Nome do embed salvo').setRequired(true).setAutocomplete(true))
                .addChannelOption(opt => opt.setName('canal').setDescription('Canal opcional (padrão: atual)').addChannelTypes(ChannelType.GuildText))
        )
        .addSubcommand(sub => 
            sub.setName('apagar')
                .setDescription('Apaga um embed salvo')
                .addStringOption(opt => opt.setName('nome').setDescription('Nome do embed salvo').setRequired(true).setAutocomplete(true))
        )
        .addSubcommand(sub =>
            sub.setName('editar')
                .setDescription('Edita um embed de uma mensagem existente através do assistente')
                .addStringOption(opt => opt.setName('mensagem_id').setDescription('O ID da mensagem do bot a ser editada').setRequired(true))
        ),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!isAdmin) return;

        const embeds = await allQuery(`SELECT id, name FROM embeds WHERE guild_id = ?`, [interaction.guild.id]);
        let choices = embeds.map(e => ({ name: e.name, value: e.name }));
        
        if (focusedValue) {
            choices = choices.filter(choice => choice.name.toLowerCase().includes(focusedValue.toLowerCase()));
        }

        await interaction.respond(choices.slice(0, 25));
    },

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        if (!isAdmin) {
            return interaction.reply({ content: 'Apenas administradores podem usar este comando.', ephemeral: true });
        }

        switch (subcommand) {
            case 'novo': return this.handleNovo(interaction);
            case 'postar': return this.handlePostar(interaction);
            case 'apagar': return this.handleApagar(interaction);
            case 'editar': return this.handleEditar(interaction);
        }
    },

    runWizard: async (interaction, isEdit = false, targetMessage = null) => {
        
        let channel;
        try {
            channel = await interaction.guild.channels.create({
                name: `wizard-embed-${interaction.user.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                    { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] }
                ]
            });
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: 'Falha ao criar o canal temporário. Verifique as permissões do bot.', ephemeral: true });
        }

        await interaction.reply({ content: `✅ O painel de criação foi iniciado em <#${channel.id}>. Siga para lá!`, ephemeral: true });

        let embedData = {
            title: '', description: '', color: null, image: null, thumbnail: null,
            authorName: '', authorIcon: '', authorUrl: '',
            footerText: '', footerIcon: '',
            fields: []
        };
        let embedHistory = [];

        if (isEdit && targetMessage && targetMessage.embeds.length > 0) {
            const existingEmbed = targetMessage.embeds[0];
            embedData.title = existingEmbed.title || '';
            embedData.description = existingEmbed.description || '';
            embedData.color = existingEmbed.color ? existingEmbed.hexColor : null;
            embedData.image = existingEmbed.image ? existingEmbed.image.url : null;
            embedData.thumbnail = existingEmbed.thumbnail ? existingEmbed.thumbnail.url : null;
            embedData.authorName = existingEmbed.author && existingEmbed.author.name ? existingEmbed.author.name : '';
            embedData.authorIcon = existingEmbed.author && existingEmbed.author.iconURL ? existingEmbed.author.iconURL : '';
            embedData.authorUrl = existingEmbed.author && existingEmbed.author.url ? existingEmbed.author.url : '';
            embedData.footerText = existingEmbed.footer && existingEmbed.footer.text ? existingEmbed.footer.text : '';
            embedData.footerIcon = existingEmbed.footer && existingEmbed.footer.iconURL ? existingEmbed.footer.iconURL : '';
            embedData.fields = existingEmbed.fields ? existingEmbed.fields.map(f => ({ name: f.name, value: f.value, inline: f.inline })) : [];
        }

        const saveState = () => {
            embedHistory.push(JSON.parse(JSON.stringify(embedData))); // Deep copy
            if (embedHistory.length > 20) embedHistory.shift(); // Max 20 undo steps
        };

        const isValidUrl = (string) => {
            try { new URL(string); return true; } catch (_) { return false; }
        };

        const buildPreviewEmbed = () => {
            const embed = new EmbedBuilder();
            let isEmpty = true;
            if (embedData.title) { embed.setTitle(embedData.title); isEmpty = false; }
            if (embedData.description) { embed.setDescription(embedData.description); isEmpty = false; }
            if (embedData.color) { embed.setColor(embedData.color); isEmpty = false; } else { embed.setColor(0x2B2D31); }
            if (embedData.image && isValidUrl(embedData.image)) { embed.setImage(embedData.image); isEmpty = false; }
            if (embedData.thumbnail && isValidUrl(embedData.thumbnail)) { embed.setThumbnail(embedData.thumbnail); isEmpty = false; }
            
            if (embedData.authorName) {
                embed.setAuthor({ 
                    name: embedData.authorName, 
                    iconURL: isValidUrl(embedData.authorIcon) ? embedData.authorIcon : null,
                    url: isValidUrl(embedData.authorUrl) ? embedData.authorUrl : null
                });
                isEmpty = false;
            }
            if (embedData.footerText) {
                embed.setFooter({
                    text: embedData.footerText,
                    iconURL: isValidUrl(embedData.footerIcon) ? embedData.footerIcon : null
                });
                isEmpty = false;
            }

            if (embedData.fields && embedData.fields.length > 0) {
                embed.setFields(embedData.fields);
                isEmpty = false;
            }
            
            if (isEmpty) embed.setDescription('*Embed vazia (edite para adicionar conteúdo)*');
            return embed;
        };

        const getDashboardComponents = () => {
            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('wiz_titleDesc').setLabel('📝 Título & Desc').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('wiz_author').setLabel('👤 Autor').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('wiz_images').setLabel('🖼️ Imagens').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('wiz_color').setLabel('🎨 Cor').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('wiz_footer').setLabel('🦶 Rodapé').setStyle(ButtonStyle.Primary)
            );
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('wiz_addField').setLabel('➕ Adicionar Campo').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('wiz_removeField').setLabel('➖ Remover Campo').setStyle(ButtonStyle.Secondary).setDisabled(embedData.fields.length === 0),
                new ButtonBuilder().setCustomId('wiz_undo').setLabel('🔙 Desfazer').setStyle(ButtonStyle.Secondary).setDisabled(embedHistory.length === 0)
            );
            const row3 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('wiz_save').setLabel('✅ Salvar e Finalizar').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('wiz_cancel').setLabel('❌ Cancelar').setStyle(ButtonStyle.Danger)
            );
            return [row1, row2, row3];
        };

        const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

        let dashboardMessage = await channel.send({
            content: `### 🛠️ Painel de Criação de Embed\nUtilize os botões abaixo para editar. Atualizações aparecerão acima.\n` + (isEdit ? `**Modo:** Edição de mensagem existente.` : `**Modo:** Criando nova embed salva.`),
            embeds: [buildPreviewEmbed()],
            components: getDashboardComponents()
        });

        const collector = channel.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 3600000 }); 

        collector.on('collect', async i => {
            if (i.message.id !== dashboardMessage.id) return; 

            if (i.customId === 'wiz_save') {
                if (isEdit) {
                    await i.deferUpdate();
                    const finalEmbed = buildPreviewEmbed();
                    try {
                        await targetMessage.edit({ embeds: [finalEmbed] });
                        await channel.send('✅ A mensagem original foi editada com sucesso! Você já pode fechar este canal recuando ou apagando-o.');
                    } catch (e) {
                        await channel.send('❌ Houve um erro ao editar a mensagem original.');
                    }
                    collector.stop();
                    return;
                }

                const saveModal = new ModalBuilder().setCustomId('wizSaveModal').setTitle('Salvar Embed');
                saveModal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('saveName').setLabel('Nome para Salvar na Database').setStyle(TextInputStyle.Short).setRequired(true)));
                await i.showModal(saveModal);
                return;
            }

            if (i.customId === 'wiz_cancel') {
                await i.reply({ content: 'Limpando canal temporário...', ephemeral: true });
                setTimeout(() => channel.delete().catch(()=>null), 3000);
                collector.stop();
                return;
            }

            if (i.customId === 'wiz_undo') {
                if (embedHistory.length > 0) {
                    embedData = embedHistory.pop();
                    await i.update({ embeds: [buildPreviewEmbed()], components: getDashboardComponents() });
                }
                return;
            }

            if (i.customId === 'wiz_removeField') {
                if (embedData.fields.length > 0) {
                    saveState();
                    embedData.fields.pop();
                    await i.update({ embeds: [buildPreviewEmbed()], components: getDashboardComponents() });
                }
                return;
            }

            let modal, input1, input2, input3;

            switch(i.customId) {
                case 'wiz_titleDesc':
                    modal = new ModalBuilder().setCustomId('wizModal_titleDesc').setTitle('Título e Descrição');
                    input1 = new TextInputBuilder().setCustomId('title').setLabel('Título (opcional)').setStyle(TextInputStyle.Short).setRequired(false).setValue(embedData.title || '');
                    input2 = new TextInputBuilder().setCustomId('description').setLabel('Descrição (opcional, máx 4000)').setStyle(TextInputStyle.Paragraph).setRequired(false).setValue(embedData.description || '');
                    modal.addComponents(new ActionRowBuilder().addComponents(input1), new ActionRowBuilder().addComponents(input2));
                    break;
                case 'wiz_author':
                    modal = new ModalBuilder().setCustomId('wizModal_author').setTitle('Autor');
                    input1 = new TextInputBuilder().setCustomId('name').setLabel('Nome do Autor').setStyle(TextInputStyle.Short).setRequired(false).setValue(embedData.authorName || '');
                    input2 = new TextInputBuilder().setCustomId('icon').setLabel('URL Ícone do Autor').setStyle(TextInputStyle.Short).setRequired(false).setValue(embedData.authorIcon || '');
                    input3 = new TextInputBuilder().setCustomId('url').setLabel('URL Link do Autor').setStyle(TextInputStyle.Short).setRequired(false).setValue(embedData.authorUrl || '');
                    modal.addComponents(new ActionRowBuilder().addComponents(input1), new ActionRowBuilder().addComponents(input2), new ActionRowBuilder().addComponents(input3));
                    break;
                case 'wiz_images':
                    modal = new ModalBuilder().setCustomId('wizModal_images').setTitle('Imagens (URLs)');
                    input1 = new TextInputBuilder().setCustomId('image').setLabel('Imagem Principal (URL)').setStyle(TextInputStyle.Short).setRequired(false).setValue(embedData.image || '');
                    input2 = new TextInputBuilder().setCustomId('thumbnail').setLabel('Thumbnail (URL menor)').setStyle(TextInputStyle.Short).setRequired(false).setValue(embedData.thumbnail || '');
                    modal.addComponents(new ActionRowBuilder().addComponents(input1), new ActionRowBuilder().addComponents(input2));
                    break;
                case 'wiz_color':
                    modal = new ModalBuilder().setCustomId('wizModal_color').setTitle('Cor (Hexadecimal)');
                    input1 = new TextInputBuilder().setCustomId('color').setLabel('Ex: #FF0000 ou vermelho, etc.').setStyle(TextInputStyle.Short).setRequired(false).setValue(embedData.color || '#2B2D31');
                    modal.addComponents(new ActionRowBuilder().addComponents(input1));
                    break;
                case 'wiz_footer':
                    modal = new ModalBuilder().setCustomId('wizModal_footer').setTitle('Rodapé (Footer)');
                    input1 = new TextInputBuilder().setCustomId('text').setLabel('Texto do Rodapé').setStyle(TextInputStyle.Short).setRequired(false).setValue(embedData.footerText || '');
                    input2 = new TextInputBuilder().setCustomId('icon').setLabel('URL Ícone do Rodapé').setStyle(TextInputStyle.Short).setRequired(false).setValue(embedData.footerIcon || '');
                    modal.addComponents(new ActionRowBuilder().addComponents(input1), new ActionRowBuilder().addComponents(input2));
                    break;
                case 'wiz_addField':
                    if (embedData.fields.length >= 25) {
                        return i.reply({ content: 'O limite do Discord é de 25 campos por embed.', ephemeral: true });
                    }
                    modal = new ModalBuilder().setCustomId('wizModal_addField').setTitle('Adicionar Novo Campo');
                    input1 = new TextInputBuilder().setCustomId('name').setLabel('Nome do Campo').setStyle(TextInputStyle.Short).setRequired(true);
                    input2 = new TextInputBuilder().setCustomId('value').setLabel('Valor / Conteúdo do Campo').setStyle(TextInputStyle.Paragraph).setRequired(true);
                    input3 = new TextInputBuilder().setCustomId('inline').setLabel('Em linha? (Digite "sim" ou deixe em branco)').setStyle(TextInputStyle.Short).setRequired(false);
                    modal.addComponents(new ActionRowBuilder().addComponents(input1), new ActionRowBuilder().addComponents(input2), new ActionRowBuilder().addComponents(input3));
                    break;
            }

            if (modal) await i.showModal(modal);
        });

        const modalCollector = channel.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id && i.isModalSubmit(),
            time: 3600000
        });

        const modalHandler = async (modInt) => {
            if (!modInt.isModalSubmit() || modInt.channelId !== channel.id || modInt.user.id !== interaction.user.id) return;
            
            const customId = modInt.customId;

            if (customId === 'wizSaveModal') {
                const saveName = modInt.fields.getTextInputValue('saveName');
                const finalEmbed = buildPreviewEmbed();
                const rawJson = finalEmbed.toJSON();
                try {
                    await runQuery(
                        `INSERT INTO embeds (guild_id, name, data, creator_id) VALUES (?, ?, ?, ?)`,
                        [interaction.guild.id, saveName, JSON.stringify({ embeds: [rawJson] }), interaction.user.id]
                    );

                    const filePath = path.join(__dirname, `../../embed-${interaction.user.id}.json`);
                    fs.writeFileSync(filePath, JSON.stringify({ embeds: [rawJson] }, null, 2), 'utf-8');
                    const attachment = new AttachmentBuilder(filePath);
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`deleteWizardChat`).setLabel('Apagar Chat Temporário').setStyle(ButtonStyle.Danger)
                    );

                    await modInt.reply({
                        content: `✅ Embed **${saveName}** salva com sucesso na database!\nAqui está o arquivo JSON da embed, caso queira guardar.`,
                        files: [attachment],
                        components: [row]
                    });

                    setTimeout(() => { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); }, 5000);
                    collector.stop();
                    interaction.client.removeListener('interactionCreate', modalHandler);
                } catch (error) {
                    console.error(error);
                    await modInt.reply({ content: 'Houve um erro ao salvar a embed na database.', ephemeral: true });
                }
                return;
            }

            saveState(); 

            if (customId === 'wizModal_titleDesc') {
                embedData.title = modInt.fields.getTextInputValue('title');
                embedData.description = modInt.fields.getTextInputValue('description');
            } else if (customId === 'wizModal_author') {
                embedData.authorName = modInt.fields.getTextInputValue('name');
                embedData.authorIcon = modInt.fields.getTextInputValue('icon');
                embedData.authorUrl = modInt.fields.getTextInputValue('url');
            } else if (customId === 'wizModal_images') {
                embedData.image = modInt.fields.getTextInputValue('image');
                embedData.thumbnail = modInt.fields.getTextInputValue('thumbnail');
            } else if (customId === 'wizModal_color') {
                let colorText = modInt.fields.getTextInputValue('color');
                if (colorText && !colorText.startsWith('#') && /^[0-9A-F]{6}$/i.test(colorText)) colorText = '#' + colorText;
                if (/^#[0-9A-F]{6}$/i.test(colorText)) {
                    embedData.color = colorText;
                } else {
                    embedData.color = null; 
                }
            } else if (customId === 'wizModal_footer') {
                embedData.footerText = modInt.fields.getTextInputValue('text');
                embedData.footerIcon = modInt.fields.getTextInputValue('icon');
            } else if (customId === 'wizModal_addField') {
                const isInline = modInt.fields.getTextInputValue('inline').toLowerCase() === 'sim' || modInt.fields.getTextInputValue('inline').toLowerCase() === 's';
                embedData.fields.push({
                    name: modInt.fields.getTextInputValue('name'),
                    value: modInt.fields.getTextInputValue('value'),
                    inline: isInline
                });
            }

            try {
                await modInt.update({ embeds: [buildPreviewEmbed()], components: getDashboardComponents() });
            } catch (error) {
                console.error("Erro no update modal:", error);
            }
        };

        interaction.client.on('interactionCreate', modalHandler);

        collector.on('end', () => {
             interaction.client.removeListener('interactionCreate', modalHandler);
        });
    },

    async handleNovo(interaction) {
        await this.runWizard(interaction, false);
    },

    async handlePostar(interaction) {
        const name = interaction.options.getString('nome');
        const channel = interaction.options.getChannel('canal') || interaction.channel;

        const embedRow = await getQuery(`SELECT data FROM embeds WHERE name = ? AND guild_id = ?`, [name, interaction.guild.id]);

        if (!embedRow) {
            return interaction.reply({ content: 'Não encontrei nenhuma embed salva com este nome.', ephemeral: true });
        }

        try {
            const embedData = JSON.parse(embedRow.data);
            await channel.send(embedData);
            await interaction.reply({ content: `Embed enviada com sucesso no canal <#${channel.id}>.`, ephemeral: true });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Houve um erro ao enviar a embed.', ephemeral: true });
        }
    },

    async handleApagar(interaction) {
        const name = interaction.options.getString('nome');
        const embedRow = await getQuery(`SELECT id FROM embeds WHERE name = ? AND guild_id = ?`, [name, interaction.guild.id]);

        if (!embedRow) {
            return interaction.reply({ content: 'Não encontrei nenhuma embed salva com este nome.', ephemeral: true });
        }

        try {
            await runQuery(`DELETE FROM embeds WHERE id = ?`, [embedRow.id]);
            await interaction.reply({ content: `Embed **${name}** apagada com sucesso da database.`, ephemeral: true });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Houve um erro ao apagar a embed.', ephemeral: true });
        }
    },

    async handleEditar(interaction) {
        const msgId = interaction.options.getString('mensagem_id');
        let targetMessage;
        
        try {
            targetMessage = await interaction.channel.messages.fetch(msgId);
        } catch (error) {
            return interaction.reply({ content: 'Não consegui encontrar a mensagem neste canal. Verifique o ID.', ephemeral: true });
        }

        if (targetMessage.author.id !== interaction.client.user.id) {
            return interaction.reply({ content: 'Eu só posso editar mensagens enviadas por mim mesmo.', ephemeral: true });
        }

        await this.runWizard(interaction, true, targetMessage);
    }
};
