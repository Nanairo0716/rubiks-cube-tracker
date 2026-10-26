// 保存データを管理するキー
const STORAGE_KEY = "rubiks_cube_solves";

// 保存済みの記録を読み込む
function loadSolves() {
    try {
        const savedData = localStorage.getItem(STORAGE_KEY);

        if (!savedData) {
            return [];
        }

        const parsedData = JSON.parse(savedData);

        // 保存データが配列でなければ初期化する
        return Array.isArray(parsedData) ? parsedData : [];
    } catch (error) {
        console.error("記録の読み込みに失敗しました:", error);
        return [];
    }
}

// 記録をブラウザに保存する
function saveSolves() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(solves));
    } catch (error) {
        console.error("記録の保存に失敗しました:", error);
        alert("記録を保存できませんでした。ブラウザの保存容量などを確認してください。");
    }
}
const timerDisplay = document.getElementById("timer");
const timerButton = document.getElementById("timerButton");
const statusDisplay = document.getElementById("status");
const pbDisplay = document.getElementById("pb");
const solveCountDisplay = document.getElementById("solveCount");
const historyList = document.getElementById("history");
const rankingList = document.getElementById("rankingList");
const rankingEmpty = document.getElementById("rankingEmpty");

const averageDisplays = {
    mo3: document.getElementById("mo3"),
    ao5: document.getElementById("ao5"),
    ao12: document.getElementById("ao12"),
    ao50: document.getElementById("ao50"),
    ao100: document.getElementById("ao100")
};

const emptyMessage = document.querySelector(".empty-message");

let running = false;
let startedAt = 0;
let animationId = null;
// Supabase 接続設定
const SUPABASE_URL = "https://vhswktrglidvrgexndhh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_H1Nie2xgxN9Kbhzc0zVPKA_mFFH_2Tu";

// Supabase クライアントを作成
const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);
let solves = loadSolves();

function formatTime(milliseconds) {
    return (milliseconds / 1000).toFixed(2);
}

function renderTimer() {
    if (!running) return;

    const elapsed = performance.now() - startedAt;
    timerDisplay.textContent = formatTime(elapsed);
    animationId = requestAnimationFrame(renderTimer);
}

function startTimer() {
    if (running) return;

    running = true;
    startedAt = performance.now();

    timerButton.textContent = "STOP SOLVE";
    statusDisplay.textContent = "SOLVING...";
    statusDisplay.style.color = "#51e0cf";

    animationId = requestAnimationFrame(renderTimer);
}

function stopTimer() {
    if (!running) return;

    const elapsed = performance.now() - startedAt;

    running = false;
    cancelAnimationFrame(animationId);

    timerDisplay.textContent = formatTime(elapsed);
    timerButton.textContent = "START SOLVE";
    statusDisplay.textContent = "SOLVE COMPLETED";
    statusDisplay.style.color = "#8b7cff";

    saveSolve(elapsed);
}

async function saveSolve(milliseconds) {
    const { data: { session } } =
        await supabaseClient.auth.getSession();

    // ログインしていない場合は、今までどおりブラウザに保存
    if (!session) {
        const solve = {
            time: milliseconds,
            date: new Date().toISOString()
        };

        solves.unshift(solve);
        saveSolves();
        renderHistory();
        return;
    }

    // ログイン中はSupabaseに保存
    const { data, error } = await supabaseClient
        .from("cube_solves")
        .insert({
            time_ms: milliseconds,
            solved_at: new Date().toISOString()
        })
        .select("id, time_ms, solved_at")
        .single();

    if (error) {
        console.error("クラウドへの記録保存に失敗しました:", error.message);
        alert("クラウドに記録を保存できませんでした。もう一度ログイン状態を確認してください。");
        return;
    }

    // 保存した記録を画面に反映
    solves.unshift({
        id: data.id,
        time: data.time_ms,
        date: data.solved_at
    });

    renderHistory();
}

function renderHistory() {
    historyList.replaceChildren();
    emptyMessage.hidden = solves.length > 0;

    const best = solves.length
        ? Math.min(...solves.map(solve => solve.time))
        : null;

    pbDisplay.textContent = best === null
        ? "--.--"
        : formatTime(best);

    solveCountDisplay.textContent = solves.length;

    solves.slice(0, 10).forEach((solve, index) => {
        const item = document.createElement("li");
        const time = document.createElement("span");
        const date = document.createElement("span");
        const deleteButton = document.createElement("button");

        time.className = "record-time";
        date.className = "record-date";

        time.textContent = `${formatTime(solve.time)} 秒`;

        date.textContent = new Date(solve.date).toLocaleString(
            "ja-JP",
            {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false
            }
        );


        if (solve.time === best) {
            time.textContent += " 🏆";
        }

        deleteButton.textContent = "🗑";
        deleteButton.className = "delete-button";
        deleteButton.type = "button";
        deleteButton.title = "この記録を削除";
        deleteButton.setAttribute("aria-label", `${formatTime(solve.time)}秒の記録を削除`);

        deleteButton.addEventListener("click", async (event) => {
            // Shiftキーを押していなければ、通常の確認を表示
            if (!event.shiftKey) {
                const confirmed = confirm(
                    `${formatTime(solve.time)}秒の記録を削除しますか？\nこの操作は取り消せません。`
                );

                if (!confirmed) return;
            }
            // 元の記録の位置を特定して削除する
            // ログイン中で、クラウドに保存された記録なら先に削除
            if (solve.id !== undefined && solve.id !== null) {
                const { data: { session } } =
                    await supabaseClient.auth.getSession();

                if (session) {
                    const { error } = await supabaseClient
                        .from("cube_solves")
                        .delete()
                        .eq("id", solve.id);

                    if (error) {
                        console.error("クラウド記録の削除に失敗しました:", error.message);
                        alert("クラウドの記録を削除できませんでした。");
                        return;
                    }
                }
            }

            solves.splice(solves.indexOf(solve), 1);

            // ログアウト中は、今までどおりブラウザに保存
            if (!solves.some(item => item.id !== undefined && item.id !== null)) {
                saveSolves();
            }

            renderHistory();
        });

        item.append(time, date, deleteButton);
        historyList.appendChild(item);
    });
    renderRanking();
    renderAverageStats();
}

function toggleTimer() {
    if (running) {
        stopTimer();
    } else {
        startTimer();
    }
}

timerButton.addEventListener("click", toggleTimer);

document.addEventListener("keydown", event => {
    if (event.code !== "Space" || event.repeat) return;

    event.preventDefault();

    if (event.target === timerButton) return;

    toggleTimer();
});

function renderRanking() {
    // 全記録をタイムの速い順に並べる
    // 元の配列を変更しないようにコピーする
    const rankedSolves = solves
        .map((solve, originalIndex) => ({
            ...solve,
            originalIndex
        }))
        .sort((a, b) => {
            return a.time - b.time ||
                a.originalIndex - b.originalIndex;
        });

    rankingList.replaceChildren();
    rankingEmpty.hidden = rankedSolves.length > 0;

    rankedSolves.forEach((solve, index) => {
        const item = document.createElement("li");
        const position = document.createElement("span");
        const details = document.createElement("div");
        const time = document.createElement("span");
        const date = document.createElement("span");

        item.className = "ranking-item";
        position.className = "ranking-position";
        details.className = "ranking-details";
        time.className = "ranking-time";
        date.className = "ranking-date";

        // 同タイムでも別記録として順位を付ける
        position.textContent = `${index + 1}位`;

        time.textContent = `${formatTime(solve.time)} 秒`;

        date.textContent = new Date(solve.date).toLocaleString(
            "ja-JP",
            {
                year: "numeric",
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        );

        if (index === 0) {
            time.textContent += " 🏆";
        }

        details.append(time, date);
        item.append(position, details);
        rankingList.appendChild(item);
    });
}

/**
 * 指定した回数の平均タイムを計算する
 * Mo3: 除外なし
 * Ao5/Ao12: 最速1回・最遅1回を除外
 * Ao50: 最速3回・最遅3回を除外
 * Ao100: 最速5回・最遅5回を除外
 */
function calculateAverage(count, trimCount) {
    // 新しい記録から指定回数を取得する
    const recentSolves = solves.slice(0, count);

    // 必要な回数がそろっていなければ計算しない
    if (recentSolves.length < count) {
        return null;
    }

    // タイムの速い順に並べ替える
    const sortedTimes = recentSolves
        .map(solve => solve.time)
        .sort((a, b) => a - b);

    // 最速・最遅の記録を除外する
    const keptTimes = sortedTimes.slice(
        trimCount,
        sortedTimes.length - trimCount
    );

    // 残った記録の平均を返す
    const total = keptTimes.reduce((sum, time) => sum + time, 0);
    return total / keptTimes.length;
}

/**
 * 5種類の平均タイムを画面に反映する
 */
function renderAverageStats() {
    const averageSettings = [
        { key: "mo3", count: 3, trim: 0 },
        { key: "ao5", count: 5, trim: 1 },
        { key: "ao12", count: 12, trim: 1 },
        { key: "ao50", count: 50, trim: 3 },
        { key: "ao100", count: 100, trim: 5 }
    ];

    averageSettings.forEach(setting => {
        const average = calculateAverage(setting.count, setting.trim);
        const display = averageDisplays[setting.key];

        display.textContent = average === null
            ? "--.--"
            : formatTime(average);
    });
}


renderHistory();
// Supabase 接続テスト
console.log(
    "Supabase client:",
    typeof supabaseClient !== "undefined"
        ? "初期化成功"
        : "初期化失敗"
);

/* ヘッダーのログイン・新規登録ポップアップ */
const authModal = document.getElementById("auth-modal");
const authModalTitle = document.getElementById("auth-modal-title");
const authSubmitButton = document.getElementById("auth-submit-button");
const authMessage = document.getElementById("auth-message");

let authMode = "login";

function openAuthModal(mode) {
    authMode = mode;

    const isSignup = mode === "signup";

    authModalTitle.textContent = isSignup ? "新規登録" : "ログイン";
    authSubmitButton.textContent = isSignup ? "新規登録" : "ログイン";
    authMessage.textContent = "";

    document.getElementById("auth-password").value = "";
    document.getElementById("auth-password").autocomplete =
        isSignup ? "new-password" : "current-password";

    authModal.hidden = false;
}

document.getElementById("header-login-button").addEventListener("click", () => {
    openAuthModal("login");
});

document.getElementById("header-signup-button").addEventListener("click", () => {
    openAuthModal("signup");
});

document.getElementById("auth-modal-close").addEventListener("click", () => {
    authModal.hidden = true;
});

authModal.addEventListener("click", (event) => {
    if (event.target === authModal) {
        authModal.hidden = true;
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !authModal.hidden) {
        authModal.hidden = true;
    }
});
/* 新規登録・ログイン処理 */
authSubmitButton.addEventListener("click", async () => {
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;

    authMessage.textContent = "";

    if (!email || !password) {
        authMessage.textContent = "メールアドレスとパスワードを入力してください。";
        return;
    }

    authSubmitButton.disabled = true;
    authMessage.textContent = "処理中...";

    try {
        if (authMode === "signup") {
            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: password,
                options: {
                    emailRedirectTo:
                        window.location.origin + window.location.pathname
                }
            });

            if (error) throw error;

            if (data.session) {
                authMessage.textContent = "新規登録が完了しました！";
            } else {
                authMessage.textContent =
                    "登録を受け付けました。確認メールが届いたら、メール内のリンクを開いてください。";
            }
        } else {
            const { error } =
                await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password
                });

            if (error) throw error;

            authMessage.textContent = "ログインしました！";
        }

        document.getElementById("auth-password").value = "";
    } catch (error) {
        authMessage.textContent =
            "エラー：" + error.message;
    } finally {
        authSubmitButton.disabled = false;
    }
});
/* ログイン状態の表示 */
const headerLoginButton = document.getElementById("header-login-button");
const headerSignupButton = document.getElementById("header-signup-button");
const headerLogoutButton = document.getElementById("header-logout-button");

function updateAuthUI(session) {
    const isLoggedIn = Boolean(session);

    headerLoginButton.hidden = isLoggedIn;
    headerSignupButton.hidden = isLoggedIn;
    headerLogoutButton.hidden = !isLoggedIn;
}

async function initializeAuthUI() {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
        console.error("ログイン状態の取得に失敗しました:", error.message);
        return;
    }

    updateAuthUI(data.session);
}

initializeAuthUI();

supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    updateAuthUI(session);

    if (session) {
        await loadCloudSolves();
    } else {
        solves = loadSolves();
        renderHistory();
    }
});

/* Supabaseから記録を読み込む */
async function loadCloudSolves() {
    const { data: { session } } =
        await supabaseClient.auth.getSession();

    if (!session) return;

    const { data, error } = await supabaseClient
        .from("cube_solves")
        .select("id, time_ms, solved_at")
        .order("solved_at", { ascending: false });

    if (error) {
        console.error("クラウド記録の読み込みに失敗しました:", error.message);
        alert("クラウド記録を読み込めませんでした。");
        return;
    }

    solves = data.map(row => ({
        id: row.id,
        time: row.time_ms,
        date: row.solved_at
    }));

    renderHistory();
}

/* ログアウト */
headerLogoutButton.addEventListener("click", async () => {
    headerLogoutButton.disabled = true;

    try {
        const { error } = await supabaseClient.auth.signOut();

        if (error) throw error;

        authModal.hidden = true;
    } catch (error) {
        alert("ログアウトに失敗しました：" + error.message);
    } finally {
        headerLogoutButton.disabled = false;
    }
});


/* ===== CubeTracker：20手スクランブル生成 ===== */

const scrambleFaces = ["U", "D", "L", "R", "F", "B"];

const scrambleColors = {
    U: "#f5f5f5",
    D: "#ffd500",
    F: "#159447",
    B: "#2864d7",
    R: "#e53935",
    L: "#ff851b"
};

// 各面のステッカーを3D座標で作成する
function createCubeStickerState() {
    const stickers = [];

    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
            const x = col - 1;
            const y = 1 - row;
            const z = col - 1;

            stickers.push(
                { face: "U", color: "U", pos: { x, y: 1, z: row - 1 }, normal: { x: 0, y: 1, z: 0 } },
                { face: "D", color: "D", pos: { x, y: -1, z: 1 - row }, normal: { x: 0, y: -1, z: 0 } },
                { face: "F", color: "F", pos: { x, y, z: 1 }, normal: { x: 0, y: 0, z: 1 } },
                { face: "B", color: "B", pos: { x: -x, y, z: -1 }, normal: { x: 0, y: 0, z: -1 } },
                { face: "R", color: "R", pos: { x: 1, y, z: -z }, normal: { x: 1, y: 0, z: 0 } },
                { face: "L", color: "L", pos: { x: -1, y, z }, normal: { x: -1, y: 0, z: 0 } }
            );
        }
    }

    return stickers;
}

// ベクトルを指定軸の周りに90度回転する
function rotateCubeVector(vector, axis, direction) {
    const { x, y, z } = vector;

    if (axis === "x") {
        return direction === 1
            ? { x, y: -z, z: y }
            : { x, y: z, z: -y };
    }

    if (axis === "y") {
        return direction === 1
            ? { x: z, y, z: -x }
            : { x: -z, y, z: x };
    }

    return direction === 1
        ? { x: -y, y: x, z }
        : { x: y, y: -x, z };
}

// R、U'、F2などの操作をキューブの状態に適用する
function applyCubeMove(stickers, move) {
    const face = move[0];

    const moveInfo = {
        R: { axis: "x", layer: 1, sign: 1 },
        L: { axis: "x", layer: -1, sign: -1 },
        U: { axis: "y", layer: 1, sign: 1 },
        D: { axis: "y", layer: -1, sign: -1 },
        F: { axis: "z", layer: 1, sign: 1 },
        B: { axis: "z", layer: -1, sign: -1 }
    };

    const { axis, layer, sign } = moveInfo[face];

    let direction = -sign;

    if (move.endsWith("'")) {
        direction *= -1;
    }

    const turns = move.endsWith("2") ? 2 : 1;

    for (let turn = 0; turn < turns; turn++) {
        for (const sticker of stickers) {
            if (sticker.pos[axis] === layer) {
                sticker.pos = rotateCubeVector(
                    sticker.pos,
                    axis,
                    direction
                );

                sticker.normal = rotateCubeVector(
                    sticker.normal,
                    axis,
                    direction
                );
            }
        }
    }
}

// ステッカーの現在位置から、面内のマス番号を計算する

function getCubeStickerIndex(sticker) {
    const { x, y, z } = sticker.pos;
    const { x: nx, y: ny, z: nz } = sticker.normal;

    let row;
    let col;

    if (ny === 1) {
        // U面：前側が手前になる向き
        row = z + 1;
        col = x + 1;
    } else if (ny === -1) {
        // D面
        row = 1 - z;
        col = x + 1;
    } else if (nz === 1) {
        // F面
        row = 1 - y;
        col = x + 1;
    } else if (nz === -1) {
        // B面
        row = 1 - y;
        col = 1 - x;
    } else if (nx === 1) {
        // R面
        row = 1 - y;
        col = 1 - z;
    } else if (nx === -1) {
        // L面
        row = 1 - y;
        col = z + 1;
    }

    return row * 3 + col;
}


// 6面の展開図を更新する

function getCubeFaceFromNormal(normal) {
    if (normal.y === 1) return "U";
    if (normal.y === -1) return "D";
    if (normal.z === 1) return "F";
    if (normal.z === -1) return "B";
    if (normal.x === 1) return "R";
    if (normal.x === -1) return "L";

    return null;
}

// 6面の展開図を更新する
function renderCubeNet(stickers) {
    const cubeNet = document.getElementById("cubeNet");
    if (!cubeNet) return;

    const faces = cubeNet.querySelectorAll(".cube-face");

    for (const faceElement of faces) {
        const face = faceElement.dataset.face;

        // ステッカーの「現在向いている面」で分類する
        const faceStickers = stickers
            .filter(sticker =>
                getCubeFaceFromNormal(sticker.normal) === face
            )
            .sort((a, b) =>
                getCubeStickerIndex(a) - getCubeStickerIndex(b)
            );

        faceElement.replaceChildren();

        for (const sticker of faceStickers) {
            const square = document.createElement("div");
            square.className = "cube-sticker";
            square.style.backgroundColor =
                scrambleColors[sticker.color];

            faceElement.appendChild(square);
        }
    }
}


// 同じ面が連続しない20手のスクランブルを生成する
function generateCubeScramble() {
    const moves = [];
    let previousFace = "";

    while (moves.length < 20) {
        const face =
            scrambleFaces[Math.floor(Math.random() * scrambleFaces.length)];

        if (face === previousFace) continue;

        const suffixes = ["", "'", "2"];
        const suffix =
            suffixes[Math.floor(Math.random() * suffixes.length)];

        moves.push(face + suffix);
        previousFace = face;
    }

    return moves;
}

// スクランブル文字列と展開図を更新する
let currentScrambleMoves = [];

function updateCubeScramble() {
    const moves = generateCubeScramble();
    currentScrambleMoves = [...moves];
    updateCubeRotationArrow(null);

    document.getElementById("scrambleText").textContent =
        moves.join(" ");

    document.getElementById("scrambleMoveCount").textContent =
        `${moves.length} MOVES`;

    const stickers = createCubeStickerState();

    for (const move of moves) {
        applyCubeMove(stickers, move);
    }

    renderCubeNet(stickers);
}

// スクランブル再生成ボタン
document.getElementById("newScrambleButton")
    .addEventListener("click", updateCubeScramble);

// スクランブルをクリップボードにコピー
document.getElementById("copyScrambleButton")
    .addEventListener("click", async () => {
        const text = document.getElementById("scrambleText").textContent;
        const button = document.getElementById("copyScrambleButton");

        try {
            await navigator.clipboard.writeText(text);

            button.textContent = "コピーしました！";

            setTimeout(() => {
                button.textContent = "コピー";
            }, 1500);
        } catch (error) {
            console.error("コピーに失敗しました:", error);
            alert("コピーできませんでした。スクランブルを手動でコピーしてください。");
        }
    });

// ページを開いたときに最初のスクランブルを生成
updateCubeScramble();

/* ===== CubeTracker：3Dプレビュー ===== */

// 表示モードを切り替える
const scrambleViewSelect = document.getElementById("scrambleViewSelect");
const cubeNetSection = document.querySelector(".cube-net-section");
const cubeNet = document.getElementById("cubeNet");
const cubeNetLabel = cubeNetSection.querySelector(".timer-label");
const cubeNetHint = cubeNetSection.querySelector(".cube-net-hint");
const cubePreviewView = document.getElementById("cubePreviewView");

scrambleViewSelect.addEventListener("change", () => {
    const isPreview = scrambleViewSelect.value === "preview";

    // 親要素ではなく、展開図とその見出しだけを隠す
    cubeNet.hidden = isPreview;
    cubeNetLabel.hidden = isPreview;
    cubeNetHint.hidden = isPreview;

    // 3Dプレビューの表示を切り替える
    cubePreviewView.hidden = !isPreview;

    if (isPreview) {
        renderCube3D(createCubeStickerState());
    }
});

// ステッカーの現在の向きから面を取得する
function getCurrentCubeFace(sticker) {
    return getCubeFaceFromNormal(sticker.normal);
}

/* ===== 3Dプレビュー用のキューブ状態 ===== */

// 現在表示しているキューブの状態
let previewCubeStickers = createCubeStickerState();

// 現在の状態を3Dキューブに反映する
function updateCube3DPreview() {
    renderCube3D(previewCubeStickers);
}

/* ===== 回転方向矢印の表示 ===== */

function updateCubeRotationArrow(move) {
    const arrow = document.getElementById("cubeRotationArrow");
    const arrowPath = document.getElementById("cubeRotationArrowPath");

    if (!arrow || !arrowPath) return;


    if (!move) {
        arrow.hidden = true;
        arrow.style.setProperty("display", "none", "important");
        return;
    }

    arrow.hidden = false;
    arrow.style.setProperty("display", "block", "important");


    // 時計回り・反時計回り・180度回転を判定
    const isDoubleTurn = move.endsWith("2");
    const isPrimeTurn = move.endsWith("'");

    let path;

    if (isDoubleTurn) {
        path = "M15 55 C30 85, 75 85, 95 40";
    } else if (isPrimeTurn) {
        path = "M95 40 C75 5, 30 5, 15 55";
    } else {
        path = "M15 55 C30 85, 75 85, 95 40";
    }

    arrowPath.setAttribute("d", path);
}


// スクランブル開始前の状態に戻す
function resetCube3DPreview() {
    previewCubeStickers = createCubeStickerState();
    updateCubeRotationArrow(null);
    updateCube3DPreview();
}

/* ===== 3Dプレビュー：指定した手数まで再現 ===== */

function showScrambleAtStep(step) {
    stopScrambleAnimation();

    scrambleAnimationIndex = Math.max(
        0,
        Math.min(step, currentScrambleMoves.length)
    );

    previewCubeStickers = createCubeStickerState();

    for (let i = 0; i < scrambleAnimationIndex; i++) {
        applyCubeMove(previewCubeStickers, currentScrambleMoves[i]);
    }

    updateCube3DPreview();
    updateCubeRotationArrow(
        scrambleAnimationIndex > 0
            ? currentScrambleMoves[scrambleAnimationIndex - 1]
            : null
    );

    if (scrambleAnimationIndex === 0) {
        scrambleAnimationStatus.textContent = "再生待機中（0手）";
    } else {
        scrambleAnimationStatus.textContent =
            `${scrambleAnimationIndex}/${currentScrambleMoves.length}手`;
    }
}


// 現在のキューブ状態から3Dキューブを描画する
function renderCube3D(stickers) {
    const cube = document.getElementById("cube3D");
    if (!cube) return;

    const faces = ["U", "L", "F", "R", "B", "D"];

    cube.replaceChildren();

    for (const face of faces) {
        const faceElement = document.createElement("div");

        faceElement.className = `cube-3d-face face-${face.toLowerCase()}`;

        const faceStickers = stickers
            .filter(sticker => getCurrentCubeFace(sticker) === face)
            .sort((a, b) =>
                getCubeStickerIndex(a) - getCubeStickerIndex(b)
            );

        for (const sticker of faceStickers) {
            const square = document.createElement("div");
            square.className = "cube-3d-sticker";
            square.style.backgroundColor = scrambleColors[sticker.color];

            faceElement.appendChild(square);
        }

        cube.appendChild(faceElement);
    }
}


/* ===== CubeTracker：スクランブル再生コントロール ===== */

let scrambleAnimationIndex = 0;
let scrambleAnimationTimer = null;
let scrambleAnimationPlaying = false;

const playScrambleButton = document.getElementById("playScrambleButton");
const pauseScrambleButton = document.getElementById("pauseScrambleButton");
const resetScrambleButton = document.getElementById("resetScrambleButton");
const scrambleSpeedSelect = document.getElementById("scrambleSpeedSelect");
const prevScrambleMoveButton = document.getElementById("prevScrambleMoveButton");
const nextScrambleMoveButton = document.getElementById("nextScrambleMoveButton");
const scrambleAnimationStatus = document.getElementById("scrambleAnimationStatus");

// 再生ボタンの状態を更新する
function updateScrambleAnimationButtons() {
    playScrambleButton.disabled = scrambleAnimationPlaying;
    pauseScrambleButton.disabled = !scrambleAnimationPlaying;
}

// 再生を停止する
function stopScrambleAnimation() {
    if (scrambleAnimationTimer !== null) {
        clearTimeout(scrambleAnimationTimer);
        scrambleAnimationTimer = null;
    }

    scrambleAnimationPlaying = false;
    updateScrambleAnimationButtons();
}

// スクランブル再生の進行を管理する
function playNextScrambleMove() {
    if (!scrambleAnimationPlaying) return;

    if (scrambleAnimationIndex >= currentScrambleMoves.length) {
        stopScrambleAnimation();
        scrambleAnimationStatus.textContent = "20手の再生が完了しました！";
        return;
    }

    const move = currentScrambleMoves[scrambleAnimationIndex];

    applyCubeMove(previewCubeStickers, move);
    updateCube3DPreview();
    updateCubeRotationArrow(move);

    scrambleAnimationStatus.textContent =
        `${scrambleAnimationIndex + 1}/20手目：${move}`;

    scrambleAnimationIndex++;

    scrambleAnimationTimer = setTimeout(() => {
        scrambleAnimationTimer = null;
        playNextScrambleMove();
    }, Number(scrambleSpeedSelect.value));
}

// 再生
playScrambleButton.addEventListener("click", () => {
    if (scrambleAnimationPlaying) return;

    if (scrambleAnimationIndex >= currentScrambleMoves.length) {
        scrambleAnimationIndex = 0;
    }

    scrambleAnimationPlaying = true;
    updateScrambleAnimationButtons();
    playNextScrambleMove();
});

/* ===== 3Dプレビュー：前の手・次の手 ===== */

prevScrambleMoveButton.addEventListener("click", () => {
    showScrambleAtStep(scrambleAnimationIndex - 1);
});

nextScrambleMoveButton.addEventListener("click", () => {
    showScrambleAtStep(scrambleAnimationIndex + 1);
});


// 一時停止
pauseScrambleButton.addEventListener("click", () => {
    stopScrambleAnimation();
    scrambleAnimationStatus.textContent =
        `一時停止：${scrambleAnimationIndex}/20手`;
});

// 最初から
resetScrambleButton.addEventListener("click", () => {
    stopScrambleAnimation();
    scrambleAnimationIndex = 0;
    scrambleAnimationStatus.textContent = "再生待機中";
    resetCube3DPreview();
});
