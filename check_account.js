const db = require('./database.js');

const channelToCheck = '#viskul';

db.getLoLAccount(channelToCheck).then(account => {
  if (account) {
    console.log(`Znaleziono konto dla kanału ${channelToCheck}:`);
    console.log(account);
  } else {
    console.log(`Nie znaleziono żadnego konta LoL przypisanego do kanału ${channelToCheck}.`);
  }
}).catch(err => {
  console.error('Wystąpił błąd podczas sprawdzania konta:', err);
});
