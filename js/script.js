import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { collection, doc, getFirestore, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const WHATSAPP_NUMBER = "556492650917";

const firebaseConfig = {
	apiKey: "AIzaSyC_HBQCP0pV3NC_oUoG58CcGZtTpiZh8cQ",
	authDomain: "dados-e-doces.firebaseapp.com",
	projectId: "dados-e-doces",
	storageBucket: "dados-e-doces.firebasestorage.app",
	messagingSenderId: "428100114159",
	appId: "1:428100114159:web:819eda0aa2ce3b77216d1a",
	measurementId: "G-3TWRNXL3TX"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let produtos = [];
let categoriaAtiva = "Cookie";
let carrinho = JSON.parse(localStorage.getItem("dadosEdoces_carrinho")) || [];
let categoriasLoja = ["Cookie", "Brownie"];
let configOferta = { ativa: false, valor: 0, categoria: "Todas" };

const listaProdutos = document.querySelector("#lista-produtos");
const containerCategorias = document.querySelector(".category-tabs");
const itensCarrinho = document.querySelector("#cart-items");
const contadorCarrinho = document.querySelector("#cart-count");
const totalCarrinho = document.querySelector("#cart-total");
const botaoPedido = document.querySelector("#checkout-button");
const feedbackCarrinho = document.querySelector("#cart-feedback");

function formatarPreco(preco) {
	return Number(preco).toLocaleString("pt-BR", {
		style: "currency",
		currency: "BRL"
	});
}

function calcularPrecoAtual(precoBase, desconto = 0) {
	return Math.max(0.01, Number(precoBase) - Number(desconto || 0));
}

function obterDescontoGlobal(produto) {
	let descontoGlobal = 0;
	if (configOferta.ativa === true && (configOferta.categoria === "Todas" || configOferta.categoria === produto.categoria)) {
		descontoGlobal = Number(configOferta.valor) || 0;
	}
	return descontoGlobal;
}

function criarTag(texto) {
	const tag = document.createElement("span");
	tag.className = "tag";
	tag.textContent = texto;
	return tag;
}

function criarCard(produto) {
	const artigo = document.createElement("article");
	artigo.className = "product-card";

	const imagemWrap = document.createElement("div");
	imagemWrap.className = "product-image-wrap";

	const imagemFallback = "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=900&q=80";
	const imagens = Array.isArray(produto.imagens) && produto.imagens.length > 0
		? produto.imagens
		: [produto.imagem || imagemFallback];
	const carouselTrack = document.createElement("div");
	carouselTrack.className = "carousel-track";

	imagens.forEach((url) => {
		const imagem = document.createElement("img");
		imagem.className = "carousel-image";
		imagem.src = url;
		imagem.alt = produto.nome;
		imagem.loading = "lazy";
		imagem.addEventListener("error", () => {
			if (imagem.src !== imagemFallback) {
				imagem.src = imagemFallback;
			}
		});
		carouselTrack.append(imagem);
	});

	imagemWrap.append(carouselTrack);

	if (imagens.length > 1) {
		let currentIndex = 0;
		const previousButton = document.createElement("button");
		previousButton.className = "carousel-btn prev";
		previousButton.type = "button";
		previousButton.textContent = "‹";
		previousButton.setAttribute("aria-label", `Imagem anterior de ${produto.nome}`);
		const nextButton = document.createElement("button");
		nextButton.className = "carousel-btn next";
		nextButton.type = "button";
		nextButton.textContent = "›";
		nextButton.setAttribute("aria-label", `Próxima imagem de ${produto.nome}`);

		const atualizarCarrossel = () => {
			carouselTrack.style.transform = `translateX(-${currentIndex * 100}%)`;
			previousButton.disabled = currentIndex === 0;
			nextButton.disabled = currentIndex === imagens.length - 1;
		};

		nextButton.addEventListener("click", () => {
			if (currentIndex < imagens.length - 1) {
				currentIndex += 1;
				atualizarCarrossel();
			}
		});
		previousButton.addEventListener("click", () => {
			if (currentIndex > 0) {
				currentIndex -= 1;
				atualizarCarrossel();
			}
		});

		imagemWrap.append(previousButton, nextButton);
	}

	const conteudo = document.createElement("div");
	conteudo.className = "product-content";

	const categoria = document.createElement("p");
	categoria.className = "product-category";
	categoria.textContent = produto.categoria;

	const titulo = document.createElement("h3");
	titulo.textContent = produto.nome;

	const descricao = document.createElement("p");
	descricao.className = "product-description";
	descricao.textContent = produto.descricao;

	const tags = document.createElement("div");
	tags.className = "product-tags";
	const descontoIndividual = Number(produto.desconto) || 0;
	let descontoGlobal = 0;
	if (configOferta.ativa === true && (configOferta.categoria === "Todas" || configOferta.categoria === produto.categoria)) {
		descontoGlobal = Number(configOferta.valor) || 0;
	}
	const descontoTotal = descontoIndividual + descontoGlobal;
	const tagsProduto = [...(produto.tags || [produto.categoria === "Brownie" ? "Buff de Glicose" : "Mordida Crítica"])];
	if (descontoTotal > 0) {
		tagsProduto.push("Promoção");
	}
	tagsProduto.forEach((tag) => {
		tags.append(criarTag(tag));
	});

	const rodape = document.createElement("div");
	rodape.className = "product-footer";

	const precos = document.createElement("div");
	const precoFinal = Math.max(0.01, Number(produto.preco) - descontoIndividual - descontoGlobal);
	const precoOriginal = document.createElement("span");
	precoOriginal.className = "price-original";
	precoOriginal.textContent = formatarPreco(Number(produto.preco));
	const preco = document.createElement("span");
	preco.className = "price-label";
	preco.textContent = formatarPreco(precoFinal);
	if (descontoTotal > 0) {
		precos.append(precoOriginal);
	}
	precos.append(preco);

	const comprar = document.createElement("button");
	comprar.className = "buy-button";
	comprar.type = "button";
	comprar.textContent = "Adicionar ao carrinho";
	comprar.addEventListener("click", () => adicionarAoCarrinho(produto));

	const acoes = document.createElement("div");
	acoes.className = "product-actions";
	acoes.append(comprar);
	rodape.append(precos, acoes);
	conteudo.append(categoria, titulo, descricao, tags, rodape);
	artigo.append(imagemWrap, conteudo);
	return artigo;
}

function renderizarAbasCategorias() {
	if (!containerCategorias) {
		return;
	}

	const categorias = Array.isArray(categoriasLoja) && categoriasLoja.length > 0
		? categoriasLoja
		: ["Cookie", "Brownie"];

	if (!categorias.includes(categoriaAtiva)) {
		categoriaAtiva = categorias[0];
	}

	containerCategorias.replaceChildren();
	categorias.forEach((categoria) => {
		const aba = document.createElement("button");
		aba.className = "category-tab";
		aba.type = "button";
		aba.role = "tab";
		aba.dataset.category = categoria;
		aba.textContent = categoria;
		const selecionada = categoria === categoriaAtiva;
		aba.classList.toggle("is-active", selecionada);
		aba.setAttribute("aria-selected", String(selecionada));
		aba.addEventListener("click", () => {
			categoriaAtiva = categoria;
			renderizarAbasCategorias();
			renderizarProdutos();
		});
		containerCategorias.append(aba);
	});
}

function renderizarProdutos() {
	listaProdutos.replaceChildren();
	const produtosFiltrados = produtos.filter((produto) => produto.categoria === categoriaAtiva);

	if (produtosFiltrados.length === 0) {
		const vazio = document.createElement("p");
		vazio.className = "empty-state";
		vazio.textContent = "Nenhum produto cadastrado nesta categoria.";
		listaProdutos.append(vazio);
		return;
	}

	produtosFiltrados.forEach((produto) => listaProdutos.append(criarCard(produto)));
}

function adicionarAoCarrinho(produto) {
	const itemExistente = carrinho.find((item) => item.produto.id === produto.id);
	if (itemExistente) {
		itemExistente.quantidade += 1;
	} else {
		carrinho.push({ produto, quantidade: 1 });
	}

	localStorage.setItem("dadosEdoces_carrinho", JSON.stringify(carrinho));
	renderizarCarrinho();
	feedbackCarrinho.textContent = `${produto.nome} adicionado ao carrinho.`;
}

function alterarQuantidade(produtoId, variacao) {
	const item = carrinho.find((itemAtual) => itemAtual.produto.id === produtoId);
	if (!item) {
		return;
	}

	item.quantidade += variacao;
	if (item.quantidade <= 0) {
		carrinho = carrinho.filter((itemAtual) => itemAtual.produto.id !== produtoId);
	}

	localStorage.setItem("dadosEdoces_carrinho", JSON.stringify(carrinho));
	renderizarCarrinho();
}

function renderizarCarrinho() {
	itensCarrinho.replaceChildren();
	const quantidadeTotal = carrinho.reduce((total, item) => total + item.quantidade, 0);
	const valorTotal = carrinho.reduce((total, item) => {
		let descontoGlobal = 0;
		if (configOferta.ativa === true && (configOferta.categoria === "Todas" || configOferta.categoria === item.produto.categoria)) {
			descontoGlobal = Number(configOferta.valor) || 0;
		}
		const precoFinal = Math.max(0.01, Number(item.produto.preco) - (Number(item.produto.desconto) || 0) - descontoGlobal);
		return total + precoFinal * item.quantidade;
	}, 0);
	contadorCarrinho.textContent = quantidadeTotal;
	totalCarrinho.textContent = formatarPreco(valorTotal);
	botaoPedido.disabled = carrinho.length === 0;

	if (carrinho.length === 0) {
		const vazio = document.createElement("p");
		vazio.className = "cart-empty";
		vazio.textContent = "Seu carrinho está vazio.";
		itensCarrinho.append(vazio);
		return;
	}

	carrinho.forEach((item) => {
		const linha = document.createElement("div");
		linha.className = "cart-item";

		const informacoes = document.createElement("div");
		informacoes.className = "cart-item-info";

		const nome = document.createElement("strong");
		nome.textContent = item.produto.nome;

		const preco = document.createElement("span");
		let descontoGlobal = 0;
		if (configOferta.ativa === true && (configOferta.categoria === "Todas" || configOferta.categoria === item.produto.categoria)) {
			descontoGlobal = Number(configOferta.valor) || 0;
		}
		const precoFinal = Math.max(0.01, Number(item.produto.preco) - (Number(item.produto.desconto) || 0) - descontoGlobal);
		preco.textContent = `${formatarPreco(precoFinal)} cada`;
		informacoes.append(nome, preco);

		const controles = document.createElement("div");
		controles.className = "cart-item-controls";

		const diminuir = document.createElement("button");
		diminuir.className = "quantity-button";
		diminuir.type = "button";
		diminuir.textContent = "−";
		diminuir.setAttribute("aria-label", `Remover uma unidade de ${item.produto.nome}`);
		diminuir.addEventListener("click", () => alterarQuantidade(item.produto.id, -1));

		const quantidade = document.createElement("span");
		quantidade.textContent = item.quantidade;

		const aumentar = document.createElement("button");
		aumentar.className = "quantity-button";
		aumentar.type = "button";
		aumentar.textContent = "+";
		aumentar.setAttribute("aria-label", `Adicionar uma unidade de ${item.produto.nome}`);
		aumentar.addEventListener("click", () => alterarQuantidade(item.produto.id, 1));

		controles.append(diminuir, quantidade, aumentar);
		linha.append(informacoes, controles);
		itensCarrinho.append(linha);
	});
}

function realizarPedido() {
	if (carrinho.length === 0) {
		return;
	}

	const linhas = carrinho.map((item) => {
		let descontoGlobal = 0;
		if (configOferta.ativa === true && (configOferta.categoria === "Todas" || configOferta.categoria === item.produto.categoria)) {
			descontoGlobal = Number(configOferta.valor) || 0;
		}
		const precoFinal = Math.max(0.01, Number(item.produto.preco) - (Number(item.produto.desconto) || 0) - descontoGlobal);
		const subtotal = precoFinal * item.quantidade;
		return `- ${item.quantidade}x ${item.produto.nome}: ${formatarPreco(precoFinal)} cada | Subtotal: ${formatarPreco(subtotal)}`;
	});
	const total = carrinho.reduce((soma, item) => {
		let descontoGlobal = 0;
		if (configOferta.ativa === true && (configOferta.categoria === "Todas" || configOferta.categoria === item.produto.categoria)) {
			descontoGlobal = Number(configOferta.valor) || 0;
		}
		const precoFinal = Math.max(0.01, Number(item.produto.preco) - (Number(item.produto.desconto) || 0) - descontoGlobal);
		return soma + precoFinal * item.quantidade;
	}, 0);
	const mensagem = [
		"Olá! Gostaria de realizar este pedido:",
		"",
		...linhas,
		"",
		`Total: ${formatarPreco(total)}`
	].join("\n");
	const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(mensagem)}`;
	window.open(url, "_blank", "noopener,noreferrer");
	carrinho = [];
	localStorage.removeItem("dadosEdoces_carrinho");
	renderizarCarrinho();
}

document.addEventListener("DOMContentLoaded", () => {
	botaoPedido.addEventListener("click", realizarPedido);
	renderizarAbasCategorias();
	renderizarCarrinho();

	onSnapshot(collection(db, "produtos"), (snapshot) => {
		const produtosFirebase = snapshot.docs.map((documento) => ({
			id: documento.id,
			...documento.data()
		}));
		produtos = produtosFirebase;
		renderizarProdutos();
	}, (erro) => {
		produtos = [];
		renderizarProdutos();
	});

	onSnapshot(doc(db, "loja", "configuracao"), (snapshot) => {
		const dados = snapshot.data() || {};
		configOferta = {
			ativa: Boolean(dados.ativa),
			valor: Number(dados.valor) || 0,
			categoria: dados.categoria || "Todas"
		};
		categoriasLoja = Array.isArray(dados.categorias) && dados.categorias.length > 0
			? dados.categorias
			: ["Cookie", "Brownie"];
		renderizarAbasCategorias();
		renderizarProdutos();
		renderizarCarrinho();
	}, (erro) => {
		configOferta = { ativa: false, valor: 0, categoria: "Todas" };
		categoriasLoja = ["Cookie", "Brownie"];
		renderizarAbasCategorias();
		renderizarProdutos();
		renderizarCarrinho();
	});
});
