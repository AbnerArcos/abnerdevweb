

const paymentCard = document.getElementById("paymentCard");
function mostrarPago(){
  paymentCard.classList.add("active");
}
function cerrarPago(){
  paymentCard.classList.remove("active");
}