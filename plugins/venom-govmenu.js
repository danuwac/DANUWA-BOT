module.exports = (client) => {
  client.onMessage(async (message) => {
    if (message.body === '.govdocmenu' && message.isGroupMsg === false) {
      try {
        await client.sendButtons(
          message.from,
          `📚 *DANUWA-MD MENU*\n\n📝 Term Test Papers (Grade 6–13)\n📘 GCE O/L Past Papers\n📗 GCE A/L Past Papers\n\n⚡ *Powered By:* ©DANUWA-MD ❤️`,
          [
            { buttonText: '📘 Term Test' },
            { buttonText: '📄 O/L Papers' },
            { buttonText: '📗 A/L Papers' }
          ],
          'Select an option below'
        );
      } catch (err) {
        console.error('❌ Error sending buttons:', err);
        await client.sendText(message.from, `❌ Error: ${err.message}`);
      }
    }

    // Handle button replies
    if (message.body === '📘 Term Test') {
      await client.sendText(message.from, '📘 Term Test papers coming soon...');
    } else if (message.body === '📄 O/L Papers') {
      await client.sendText(message.from, '📄 Loading O/L Past Papers...');
    } else if (message.body === '📗 A/L Papers') {
      await client.sendText(message.from, '📗 Loading A/L Past Papers...');
    }
  });
};
