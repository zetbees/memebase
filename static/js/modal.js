/* -- DOM refs -- */

const modal = document.getElementById("modal");
const mMedia = document.getElementById("m-media");
const mName = document.getElementById("m-name");
const mExt = document.getElementById("m-ext");
const mTags = document.getElementById("m-tags");
const mDesc = document.getElementById("m-desc");
const mDate = document.getElementById("m-date");
const infoModal = document.getElementById("info-modal");
const infoList = document.getElementById("info-list");
let currentId = null;
let currentMeta = null;
let initialFormState = "";

document.getElementById("m-prev").innerHTML = icon("chevron-left", 28);
document.getElementById("m-next").innerHTML = icon("chevron-right", 28);

function formState() {
	return JSON.stringify([mName.value, mTags.value, mDesc.value]);
}

function hasUnsavedChanges() {
	return initialFormState && formState() !== initialFormState;
}

function visibleCards() {
	return Array.from(grid.querySelectorAll(".card"));
}

function updateNavigation() {
	const cards = visibleCards();
	const index = cards.findIndex((card) => card.dataset.id === currentId);
	const pageSize = getPerPage();
	const totalPages = Math.max(1, Math.ceil(totalMemes / pageSize));
	document.getElementById("m-prev").disabled = index <= 0 && currentPage <= 1;
	document.getElementById("m-next").disabled = index === cards.length - 1 && currentPage >= totalPages;
	const overallIndex = index < 0 ? 0 : (currentPage - 1) * pageSize + index + 1;
	document.getElementById("m-position").textContent = `${overallIndex} / ${totalMemes}`;
}

function setActualSize(enabled) {
	mMedia.classList.toggle("actual-size", enabled);
	const zoomBtn = document.getElementById("m-zoom");
	zoomBtn.textContent = enabled ? "Fit to screen" : "Actual size";
	zoomBtn.setAttribute("aria-pressed", String(enabled));
}

function openCard(card) {
	currentId = card.dataset.id;
	const filename = card.dataset.filename;
	const [stem, ext] = splitExt(filename);
	const src = `/memes/${currentId}/${encodeURIComponent(filename)}`;
	if (isVideo(filename)) {
		mMedia.innerHTML = `<video src="${src}" controls loop autoplay></video>`;
	} else {
		mMedia.innerHTML = `<img src="${src}" alt="${esc(filename)}">`;
	}
	setActualSize(false);
	mName.value = stem;
	mExt.textContent = ext;
	mTags.value = card.dataset.tags;
	mDesc.value = card.dataset.desc;
	initialFormState = formState();
	const mFav = document.getElementById("m-fav");
	const isFav = card.dataset.fav === "1";
	mFav.innerHTML = `${icon("heart", 14)} Favorite`;
	mFav.classList.toggle("active", isFav);
	mDate.textContent = card.dataset.created ? card.dataset.created.replace("T", " ") : "";
	document.getElementById("m-size").textContent = formatSize(Number(card.dataset.size) || 0);
	document.getElementById("m-info").innerHTML = `${icon("info", 14)} Details`;
	const mCopy = document.getElementById("m-copy");
	mCopy.innerHTML =
		icon(canCopy(filename) ? "clipboard" : "download", 14) +
		(canCopy(filename) ? " Copy" : " Download");
	autoOpenBtn.disabled = isVideo(filename);
	autoOpenBtn.title = isVideo(filename) ? "Auto-detect is not available for videos" : "";
	updateNavigation();
	refreshIcons();
	loadMeta(currentId);
}

async function navigateMeme(offset) {
	if (hasUnsavedChanges() && !window.confirm("Discard unsaved changes?")) return;
	let cards = visibleCards();
	let index = cards.findIndex((card) => card.dataset.id === currentId);
	let nextIndex = index + offset;
	if (nextIndex >= 0 && nextIndex < cards.length) {
		openCard(cards[nextIndex]);
		return;
	}
	const totalPages = Math.max(1, Math.ceil(totalMemes / getPerPage()));
	if (offset > 0 && currentPage < totalPages) {
		currentPage += 1;
	} else if (offset < 0 && currentPage > 1) {
		currentPage -= 1;
	} else {
		return;
	}
	prevIds = new Set();
	await load(search.value);
	cards = visibleCards();
	index = offset > 0 ? 0 : cards.length - 1;
	if (cards[index]) openCard(cards[index]);
}

/* -- Metadata (prefetched on open for the info modal) -- */

async function loadMeta(id) {
	currentMeta = null;
	try {
		const meme = await Api.getMeme(id);
		if (currentId === id) currentMeta = meme;
	} catch {
		/* the info button fetches on demand if this failed */
	}
}

/* -- Info modal (all metadata) -- */

function formatDuration(seconds) {
	const total = Math.round(seconds);
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${m}:${String(s).padStart(2, "0")}`;
}

function infoRows(meme) {
	const rows = [
		["Filename", meme.filename],
		["Type", meme.ext ? meme.ext.toUpperCase() : ""],
		["Size", formatSize(meme.size)],
		["Dimensions", meme.width && meme.height ? `${meme.width}x${meme.height}` : ""],
		["Duration", meme.duration ? formatDuration(meme.duration) : ""],
		["Added", (meme.created_at || "").replace("T", " ")],
		["Tags", (meme.tags || []).join(", ")],
	];
	if (meme.source_url) {
		rows.push(
			["Site", meme.source_site],
			["Author", meme.source_author ? `@${meme.source_author}` : ""],
			["Posted", meme.source_date],
			["Post text", meme.source_text],
			["URL", meme.source_url],
		);
	}
	return rows.filter(([, v]) => v);
}

function renderInfo(meme) {
	infoList.innerHTML = infoRows(meme)
		.map(([k, v]) => {
			const value =
				k === "URL"
					? `<a href="${esc(v)}" target="_blank" rel="noopener noreferrer">${esc(v)}</a>`
					: esc(v);
			return `<dt>${esc(k)}</dt><dd>${value}</dd>`;
		})
		.join("");
}

document.getElementById("m-info").addEventListener("click", async () => {
	let meme = currentMeta;
	if (!meme) {
		try {
			meme = await Api.getMeme(currentId);
			currentMeta = meme;
		} catch {
			showAlert("Could not load details", "error");
			return;
		}
	}
	renderInfo(meme);
	infoModal.showModal();
});

wireDialog(infoModal, { cancel: "info-close" });

const autoOpenBtn = document.getElementById("m-auto-open");
if (!window.AI_ENABLED) autoOpenBtn.style.display = "none";
const delBtn = document.getElementById("m-delete");

/* -- Open modal (card click) -- */

grid.addEventListener("click", (e) => {
	if (e.shiftKey || e.ctrlKey || e.metaKey) return;
	const favBtn = e.target.closest(".btn-fav");
	if (favBtn) {
		e.stopPropagation();
		const card = favBtn.closest(".card");
		const newFav = card.dataset.fav === "1" ? 0 : 1;
		card.dataset.fav = newFav;
		favBtn.innerHTML = icon("heart", 18);
		favBtn.classList.toggle("active", !!newFav);
		refreshIcons();
		Api.updateMeme(card.dataset.id, { favorite: newFav });
		return;
	}
	const copyBtn = e.target.closest(".btn-copy");
	if (copyBtn) {
		e.stopPropagation();
		const card = copyBtn.closest(".card");
		if (canCopy(copyBtn.dataset.filename)) copyImage(copyBtn.dataset.src, copyBtn);
		else downloadFile(copyBtn.dataset.src, copyBtn.dataset.filename);
		return;
	}
	const card = e.target.closest(".card");
	if (!card) return;
	openCard(card);
	modal.showModal();
	modal.focus();
});

document.getElementById("m-prev").addEventListener("click", () => navigateMeme(-1));
document.getElementById("m-next").addEventListener("click", () => navigateMeme(1));
document.getElementById("m-close").addEventListener("click", () => {
	document.getElementById("m-cancel").click();
});
document.getElementById("m-zoom").addEventListener("click", () => {
	setActualSize(!mMedia.classList.contains("actual-size"));
});
mMedia.addEventListener("click", (e) => {
	if (e.target.matches("img")) setActualSize(!mMedia.classList.contains("actual-size"));
});

/* -- Favorite -- */

document.getElementById("m-fav").addEventListener("click", async () => {
	const mFav = document.getElementById("m-fav");
	const card = grid.querySelector(`.card[data-id="${currentId}"]`);
	const newFav = card && card.dataset.fav === "1" ? 0 : 1;
	if (card) {
		card.dataset.fav = newFav;
		const btn = card.querySelector(".btn-fav");
		if (btn) {
			btn.innerHTML = icon("heart", 18);
			btn.classList.toggle("active", !!newFav);
		}
	}
	mFav.innerHTML = `${icon("heart", 14)} Favorite`;
	mFav.classList.toggle("active", !!newFav);
	refreshIcons();
	await Api.updateMeme(currentId, { favorite: newFav });
});

/* -- Copy / Download -- */

document.getElementById("m-copy").addEventListener("click", () => {
	const mCopy = document.getElementById("m-copy");
	const filename = mName.value.trim() + mExt.textContent;
	const mediaSrc = mMedia.querySelector("img, video")?.src || "";
	if (canCopy(filename)) copyImage(mediaSrc, mCopy);
	else downloadFile(mediaSrc, filename);
});

/* -- Delete -- */

const resetDel = confirmButton(delBtn, "Really delete?", async () => {
	try {
		await Api.deleteMeme(currentId);
		modal.close();
		showAlert(`Deleted ${mName.value}${mExt.textContent}`, "success");
		const card = grid.querySelector(`.card[data-id="${currentId}"]`);
		if (card) {
			card.classList.add("removing");
			await new Promise((r) => setTimeout(r, 200));
		}
		load(search.value);
	} catch (e) {
		showAlert(`${mName.value}${mExt.textContent}: ${e.message || "Delete failed"}`, "error");
	}
});

/* -- Auto-detect -- */

autoOpenBtn.addEventListener("click", () => {
	const autoModal = document.getElementById("auto-modal");
	document.getElementById("auto-title").textContent = "Auto-detect";
	document.getElementById("auto-name").checked = true;
	document.getElementById("auto-desc").checked = true;
	document.getElementById("auto-tags").checked = true;
	registerAutoCallback(async (fields, startBtn) => {
		startBtn.classList.add("loading");
		try {
			const data = await Api.autoDetect(currentId);
			if (fields.includes("name") && data.name) mName.value = data.name;
			if (fields.includes("description") && data.description) mDesc.value = data.description;
			if (fields.includes("tags") && data.tags) mTags.value = data.tags.join(", ");
		} catch (e) {
			showAlert(`${mName.value}${mExt.textContent}: Auto failed - ${e.message}`, "error");
		} finally {
			startBtn.classList.remove("loading");
			autoModal.close();
		}
	});
	autoModal.showModal();
});

/* -- Close & keyboard -- */

modal.addEventListener("close", () => {
	resetDel();
	const vid = mMedia.querySelector("video");
	if (vid) {
		vid.pause();
		vid.src = "";
	}
});

wireDialog(modal, { cancel: "m-cancel", submit: "m-save" });
modal.addEventListener("keydown", (e) => {
	if (!e.target.matches("input, textarea") && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
		e.preventDefault();
		navigateMeme(e.key === "ArrowLeft" ? -1 : 1);
		return;
	}
	if (e.key === "f" && !e.target.matches("input, textarea")) {
		e.preventDefault();
		document.getElementById("m-fav").click();
	}
});

/* -- Save -- */

document.getElementById("m-save").addEventListener("click", async () => {
	const body = {};
	body.new_name = mName.value.trim();
	body.description = mDesc.value;
	body.tags = mTags.value
		.split(",")
		.map((t) => t.trim())
		.filter(Boolean);
	try {
		await Api.updateMeme(currentId, body);
		initialFormState = formState();
	} catch (e) {
		showAlert(`${mName.value}${mExt.textContent}: ${e.message}`, "error");
		return;
	}
	modal.close();
	showAlert(`Saved ${mName.value}${mExt.textContent}`, "success");
	load(search.value);
});
