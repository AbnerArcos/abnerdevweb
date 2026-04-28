document.addEventListener("DOMContentLoaded", () => {

  const pagarBtn = document.getElementById("pagarBtn");

  // 🔐 Lista de códigos y sus links
  const codigos = {
    "Menus2026": "https://buy.stripe.com/bJedRb3v630kh0Od0L18c05",
    "Premium2026": "https://buy.stripe.com/TU_LINK_PREMIUM",
    "Basico2026": "https://buy.stripe.com/TU_LINK_BASICO",
    "ClienteVIP": "https://buy.stripe.com/TU_LINK_VIP"
  };

  pagarBtn.addEventListener("click", (e) => {
    e.preventDefault();

    const codigo = prompt("Ingresa tu código de acceso:");

    if (codigo === null) return; // si cancela

    if (codigos[codigo]) {
      window.open(codigos[codigo], "_blank");
    } else {
      alert("Código incorrecto ❌");
    }

  });

});
