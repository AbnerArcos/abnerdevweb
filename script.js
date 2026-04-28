document.addEventListener("DOMContentLoaded", () => {

  const pagarBtn = document.getElementById("pagarBtn");

  pagarBtn.addEventListener("click", (e) => {
    e.preventDefault();

    const codigoCorrecto = "GLACK2025"; // 🔐 cámbialo por el que quieras

    const codigo = prompt("Ingresa tu código de acceso:");

    if (codigo === codigoCorrecto) {
      // ✅ Redirige a Stripe
      window.open("https://buy.stripe.com/28EcN76HigRa39YbWH18c00", "_blank");
    } else if (codigo !== null) {
      alert("Código incorrecto ❌");
    }

  });

});