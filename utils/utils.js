exports.initiateStep = () => ({
  menu: 1,
  menu_network_option: 1,
  menu_package_option: 0,
  menu_recipient: 0,
  menu_confirm: 0,
  selected_network: null,
});

exports.selection = (input) => {
  const map = { "1": "MTN", "2": "AT", "3": "Telecel" };
  return map[input] || null;
};
