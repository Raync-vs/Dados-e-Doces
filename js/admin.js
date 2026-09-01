import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
	getAuth,
	onAuthStateChanged,
	signInWithEmailAndPassword,
	signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	getFirestore,
	onSnapshot,
	setDoc,
	updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
	apiKey: "AIzaSyC_HBQCP0pV3NC_oUoG58CcGZtTpiZh8cQ",
	authDomain: "dados-e-doces.firebaseapp.com",
	projectId: "dados-e-doces",
	messagingSenderId: "428100114159",
	appId: "1:428100114159:web:819eda0aa2ce3b77216d1a",
	measurementId: "G-3TWRNXL3TX"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loginSection = document.querySelector("#login-section");
const adminSection = document.querySelector("#admin-section");
const loginForm = document.querySelector("#login-form");
const promoForm = document.querySelector("#promo-form");
const promoActive = document.querySelector("#promo-active");
const promoValue = document.querySelector("#promo-value");
const promoCategory = document.querySelector("#promo-category");
const promoStatusText = document.querySelector("#promo-status-text");
const productForm = document.querySelector("#product-form");
const categoryForm = document.querySelector("#category-form");
const categoryInput = document.querySelector("#new-category");
const productCategory = document.querySelector("#product-category");
const imagensUpload = document.querySelector("#imagens-upload");
const logoutButton = document.querySelector("#logout-button");
const loginFeedback = document.querySelector("#login-feedback");
const adminVitrine = document.querySelector("#admin-vitrine");
const vitrineStatus = document.querySelector("#vitrine-status");

function setLoading(formulario, estaCarregando) {
	formulario.querySelector("button[type=submit]").disabled = estaCarregando;
}

function obterCategoriasPadrao() {
	return ["Cookie", "Brownie"];
}

function normalizarCategoria(valor) {
	return String(valor || "").trim().replace(/\s+/g, " ");
}

function obterCategoriasConfiguradas(dadosConfiguracao = {}) {
	const categoriasSalvas = Array.isArray(dadosConfiguracao.categorias) ? dadosConfiguracao.categorias : [];
	return Array.from(new Set([...obterCategoriasPadrao(), ...categoriasSalvas])).filter(Boolean).map((categoria) => categoria.trim());
}

function atualizarOpcoesCategoria(categorias) {
	const valorAtual = productCategory.value;
	productCategory.replaceChildren();

	const opcaoPadrao = document.createElement("option");
	opcaoPadrao.value = "";
	opcaoPadrao.textContent = "Escolha uma categoria";
	opcaoPadrao.disabled = true;
	opcaoPadrao.selected = !valorAtual;
	productCategory.append(opcaoPadrao);

	categorias.forEach((categoria) => {
		const opcao = document.createElement("option");
		opcao.value = categoria;
		opcao.textContent = categoria;
		opcao.selected = categoria === valorAtual;
		productCategory.append(opcao);
	});
}

function formatarPreco(preco) {
	return Number(preco).toLocaleString("pt-BR", {
		style: "currency",
		currency: "BRL"
	});
}

function atualizarStatusOferta(dadosConfiguracao = {}) {
	if (!promoStatusText) {
		return;
	}

	const ativa = Boolean(dadosConfiguracao.ativa);
	const valor = Number(dadosConfiguracao.valor) || 0;
	const categoria = dadosConfiguracao.categoria || "Todas";

	if (!ativa) {
		promoStatusText.textContent = "Oferta inativa";
		return;
	}

	promoStatusText.textContent = `Ativa: ${formatarPreco(valor)} em ${categoria}`;
}

function criarCardAdmin(produto) {
	const artigo = document.createElement("article");
	artigo.className = "product-card admin-product-card";

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
	const ofertaAtiva = document.querySelector("#promo-active").checked;
	const ofertaValor = Number(document.querySelector("#promo-value").value) || 0;
	const ofertaCategoria = document.querySelector("#promo-category").value;
	let descontoGlobal = 0;
	if (ofertaAtiva && (ofertaCategoria === "Todas" || ofertaCategoria === produto.categoria)) {
		descontoGlobal = ofertaValor;
	}
	const preco = document.createElement("p");
	preco.className = "price-label";
	preco.textContent = formatarPreco(Math.max(0, Number(produto.preco) - (Number(produto.desconto) || 0) - descontoGlobal));

	const quickDiscountWrap = document.createElement("div");
	quickDiscountWrap.className = "quick-discount-wrap";
	const quickDiscountInput = document.createElement("input");
	quickDiscountInput.type = "number";
	quickDiscountInput.min = "0";
	quickDiscountInput.step = "1";
	quickDiscountInput.value = String(Number(produto.desconto) || 0);
	quickDiscountInput.className = "quick-discount";
	const quickDiscountButton = document.createElement("button");
	quickDiscountButton.type = "button";
	quickDiscountButton.className = "discount-btn";
	quickDiscountButton.textContent = "Aplicar";
	quickDiscountButton.addEventListener("click", async () => {
		await updateDoc(doc(db, "produtos", produto.id), {
			desconto: Number(quickDiscountInput.value) || 0
		});
		await renderizarVitrine();
	});
	quickDiscountWrap.append(quickDiscountInput, quickDiscountButton);

	const deletar = document.createElement("button");
	deletar.className = "delete-button";
	deletar.type = "button";
	deletar.textContent = "Deletar";
	deletar.addEventListener("click", () => deletarProduto(produto.id, produto.nome, deletar));
	conteudo.append(categoria, titulo, preco, quickDiscountWrap, deletar);
	artigo.append(imagemWrap, conteudo);
	return artigo;
}

async function renderizarVitrine() {
	adminVitrine.replaceChildren();
	vitrineStatus.textContent = "Carregando...";
	try {
		const snapshot = await getDocs(collection(db, "produtos"));
		const produtos = snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
		const produtosValidos = produtos.filter((produto) => Array.isArray(produto.imagens) && produto.imagens.length > 0);
		if (produtosValidos.length === 0) {
			const vazio = document.createElement("p");
			vazio.className = "empty-state";
			vazio.textContent = "Nenhum produto cadastrado.";
			adminVitrine.append(vazio);
		} else {
			produtosValidos.forEach((produto) => adminVitrine.append(criarCardAdmin(produto)));
		}
		vitrineStatus.textContent = `${produtosValidos.length} produto(s)`;
	} catch (erro) {
		vitrineStatus.textContent = "Não foi possível carregar a vitrine.";
		console.error("Erro ao carregar produtos:", erro);
	}
}

async function deletarProduto(produtoId, nomeProduto, botao) {
	if (!window.confirm(`Deletar ${nomeProduto}?`)) {
		return;
	}
	botao.disabled = true;
	try {
		await deleteDoc(doc(db, "produtos", produtoId));
		await renderizarVitrine();
	} catch (erro) {
		botao.disabled = false;
		vitrineStatus.textContent = "Não foi possível deletar o produto.";
		console.error("Erro ao deletar produto:", erro);
	}
}

promoForm.addEventListener("submit", async (evento) => {
	evento.preventDefault();
	const botaoSubmit = promoForm.querySelector("button[type=submit]");
	botaoSubmit.disabled = true;
	botaoSubmit.textContent = "Salvando...";

	try {
		await setDoc(doc(db, "loja", "configuracao"), {
			ativa: promoActive.checked,
			valor: Number(promoValue.value),
			categoria: promoCategory.value
		}, { merge: true });
		atualizarStatusOferta({
			ativa: promoActive.checked,
			valor: Number(promoValue.value),
			categoria: promoCategory.value
		});
		alert("Oferta salva com sucesso!");
	} catch (erro) {
		alert("Não foi possível salvar a oferta. Tente novamente.");
		console.error("Erro ao salvar oferta global:", erro);
	} finally {
		botaoSubmit.disabled = false;
		botaoSubmit.textContent = "Salvar Oferta";
	}
});

loginForm.addEventListener("submit", async (evento) => {
	evento.preventDefault();
	loginFeedback.textContent = "";
	setLoading(loginForm, true);

	const email = loginForm.elements.email.value.trim();
	const senha = loginForm.elements.password.value;

	try {
		await signInWithEmailAndPassword(auth, email, senha);
	} catch (erro) {
		loginFeedback.textContent = "Não foi possível entrar. Confira o e-mail e a senha.";
	} finally {
		setLoading(loginForm, false);
	}
});

categoryForm.addEventListener("submit", async (evento) => {
	evento.preventDefault();
	const nomeCategoria = normalizarCategoria(categoryInput.value);
	if (!nomeCategoria) {
		alert("Digite uma categoria válida para adicionar.");
		return;
	}

	const botaoSubmit = categoryForm.querySelector("button[type=submit]");
	botaoSubmit.disabled = true;
	botaoSubmit.textContent = "Adicionando...";

	try {
		const configuracaoAtual = await getDoc(doc(db, "loja", "configuracao"));
		const categoriasAtuais = obterCategoriasConfiguradas(configuracaoAtual.exists() ? configuracaoAtual.data() : {});

		if (categoriasAtuais.some((categoria) => categoria.toLowerCase() === nomeCategoria.toLowerCase())) {
			alert("Essa categoria já existe.");
			return;
		}

		const categoriasAtualizadas = [...categoriasAtuais, nomeCategoria];
		await setDoc(doc(db, "loja", "configuracao"), {
			categorias: categoriasAtualizadas
		}, { merge: true });

		categoryInput.value = "";
		productCategory.value = nomeCategoria;
		atualizarOpcoesCategoria(categoriasAtualizadas);
		alert("Categoria adicionada com sucesso!");
	} catch (erro) {
		alert("Não foi possível adicionar a categoria. Tente novamente.");
		console.error("Erro ao adicionar categoria:", erro);
	} finally {
		botaoSubmit.disabled = false;
		botaoSubmit.textContent = "Adicionar categoria";
	}
});

productForm.addEventListener("submit", async (evento) => {
	evento.preventDefault();
	const botaoSubmit = productForm.querySelector("button[type=submit]");
	const dados = new FormData(productForm);
	const arquivos = Array.from(imagensUpload.files);
	botaoSubmit.disabled = true;
	botaoSubmit.textContent = "Fazendo upload...";

	try {
		const imagens = await Promise.all(arquivos.map(async (arquivo) => {
			const formDataImgBB = new FormData();
			formDataImgBB.append("key", "15384525cce834d491f7b2517bce2000");
			formDataImgBB.append("image", arquivo);
			const resposta = await fetch("https://api.imgbb.com/1/upload", {
				method: "POST",
				body: formDataImgBB
			});
			if (!resposta.ok) {
				throw new Error(`Falha no upload da imagem: ${resposta.status}`);
			}
			const json = await resposta.json();
			if (!json.data?.url) {
				throw new Error("O ImgBB não retornou uma URL válida.");
			}
			return json.data.url;
		}));

		await addDoc(collection(db, "produtos"), {
			nome: dados.get("nome").trim(),
			categoria: dados.get("categoria"),
			preco: Number(dados.get("preco")),
			desconto: Number(dados.get("desconto")) || 0,
			descricao: dados.get("descricao").trim(),
			imagens
		});

		productForm.reset();
		await renderizarVitrine();
		alert("Loot salvo com sucesso!");
	} catch (erro) {
		alert("Não foi possível salvar o produto. Tente novamente.");
	} finally {
		botaoSubmit.disabled = false;
		botaoSubmit.textContent = "Salvar Loot";
	}
});

logoutButton.addEventListener("click", async () => {
	try {
		await signOut(auth);
	} catch (erro) {
		loginFeedback.textContent = "Não foi possível sair. Tente novamente.";
	}
});

onAuthStateChanged(auth, async (usuario) => {
	const estaAutenticado = Boolean(usuario);
	loginSection.hidden = estaAutenticado;
	adminSection.hidden = !estaAutenticado;

	if (!estaAutenticado) {
		productForm.reset();
		adminVitrine.replaceChildren();
		vitrineStatus.textContent = "";
		return;
	}

	const configuracao = await getDoc(doc(db, "loja", "configuracao"));
	if (configuracao.exists()) {
		const dadosConfiguracao = configuracao.data();
		promoActive.checked = Boolean(dadosConfiguracao.ativa);
		promoValue.value = Number.isFinite(Number(dadosConfiguracao.valor)) ? String(Number(dadosConfiguracao.valor)) : "0";
		promoCategory.value = ["Todas", "Brownie", "Cookie"].includes(dadosConfiguracao.categoria) ? dadosConfiguracao.categoria : "Todas";
		atualizarStatusOferta(dadosConfiguracao);
		atualizarOpcoesCategoria(obterCategoriasConfiguradas(dadosConfiguracao));
	} else {
		promoActive.checked = false;
		promoValue.value = "0";
		promoCategory.value = "Todas";
		atualizarStatusOferta({ ativa: false, valor: 0, categoria: "Todas" });
		atualizarOpcoesCategoria(obterCategoriasConfiguradas({}));
	}

	const unsubscribeOferta = onSnapshot(doc(db, "loja", "configuracao"), (snapshot) => {
		const dadosConfiguracao = snapshot.exists() ? snapshot.data() : { ativa: false, valor: 0, categoria: "Todas" };
		promoActive.checked = Boolean(dadosConfiguracao.ativa);
		promoValue.value = Number.isFinite(Number(dadosConfiguracao.valor)) ? String(Number(dadosConfiguracao.valor)) : "0";
		promoCategory.value = ["Todas", "Brownie", "Cookie"].includes(dadosConfiguracao.categoria) ? dadosConfiguracao.categoria : "Todas";
		atualizarStatusOferta(dadosConfiguracao);
		renderizarVitrine();
	}, (erro) => {
		console.error("Erro ao acompanhar oferta global:", erro);
		atualizarStatusOferta({ ativa: false, valor: 0, categoria: "Todas" });
	});

	await renderizarVitrine();
	return unsubscribeOferta;
});
