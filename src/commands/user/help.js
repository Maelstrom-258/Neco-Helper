const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Mostra todos os comandos disponíveis no bot'),
    async execute(interaction) {
        const adminPerm = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        const embed = new EmbedBuilder()
            .setTitle('🛠️ Central de Ajuda do Neco-Ticket')
            .setDescription('Aqui estão todos os comandos disponíveis.')
            .setColor(0xFFD700)
            .setFooter({ text: 'Neco-Helper, made with 💛 by Team Riptide', iconURL: interaction.client.user.displayAvatarURL() });

        let adminCommands = '';
        let userCommands = '';

        interaction.client.commands.forEach(cmd => {
            if (cmd.data.default_member_permissions == String(PermissionFlagsBits.Administrator)) {
                adminCommands += `**/${cmd.data.name}** - ${cmd.data.description}\n`;
            } else {
                userCommands += `**/${cmd.data.name}** - ${cmd.data.description}\n`;
            }
        });

        if (userCommands) {
            embed.addFields({ name: '👥 Comandos Públicos', value: userCommands || 'Nenhum' });
        }

        if (adminPerm && adminCommands) {
            embed.addFields({ name: '🛡️ Comandos de Nyadmins', value: adminCommands || 'Nenhum' });
        }

        await interaction.reply({ embeds: [embed] });
    }
};
