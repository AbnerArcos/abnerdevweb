document.addEventListener("DOMContentLoaded", () => {

  const servicesBtn = document.getElementById("servicesBtn");
  const contactBtn = document.getElementById("contactBtn");
  const whatsappBtn = document.getElementById("whatsappBtn");

  servicesBtn.addEventListener("click", () => {
    document.getElementById("services").scrollIntoView({
      behavior: "smooth"
    });
  });

  contactBtn.addEventListener("click", () => {
    document.getElementById("contact").scrollIntoView({
      behavior: "smooth"
    });
  });

  whatsappBtn.addEventListener("click", () => {
    const numero = "529811064643"; // Cambia por tu número
    const mensaje = "Hola Abner, me interesa tu servicio de desarrollo web.";
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, "_blank");
  });

});