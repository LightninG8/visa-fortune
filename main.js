(async () => {
  // ---------- TG WEB APP ----------
  const tg = window.Telegram?.WebApp;

  if (tg) {
    tg.expand();
  }

  // ---------- Проверка времени работы (МСК 12:00 - 22:00) ----------
  function isWheelOpen() {
    const now = new Date();

    const moscowTime = new Date(
      now.toLocaleString("en-US", { timeZone: "Europe/Moscow" }),
    );

    const hours = moscowTime.getHours();

    return hours >= 12 && hours < 22;
  }

  if (!isWheelOpen()) {
    document.body.innerHTML = `
    <div style="
      display:flex;
      align-items:center;
      justify-content:center;
      height:100vh;
      font-size:48px;
      font-weight:700;
      color:white;
      text-align:center;
      background: url('./img/bg.png');
      background-size: cover;
      background-position: center center;
      font-family:sans-serif;
    ">
      VISA SPIN закрыт
    </div>
  `;

    return;
  }

  // Запускаем всё только после полной готовности WebView

  // tg.ready(async () => {
  // ---------- DOM элементы ----------
  const wheelSpinnerElem = document.querySelector(".wheel__spinner");
  const wheelSpinButtonElem = document.querySelector(".spin-img");

  const availableSpinsElem = document.querySelector(".available-spins");
  const dealSpinsElem = document.querySelector(".deal-spins");
  const popupElem = document.querySelector(".popup");
  const popupCloseElem = document.querySelector(".popup__close");

  // ---------- Получение переменных пользователя ----------
  const urlParams = new URLSearchParams(window.location.search);
  const clientId = +urlParams.get("c") ?? 0;

  const user = await fetch(
    "https://chatter.salebot.pro/api/e6a3af53e2e63cd6a4894fe3b8f11ada/get_variables?client_id=" +
      clientId,
  ).then((res) => res.json());

  let availableSpins = +user["доступно_вращений"] || 0;
  let dealSpins = +user["сделано_вращений"] || 0;
  let lastPrize = +user["последний_подарок"] || 0;
  let finalPrizeAvailable =
    user["есть_финальная_попытка"] == "False"
      ? false
      : user["есть_финальная_попытка"] == "True"
        ? true
        : false || false;

  // список призов
  const prizes = [
    {
      text: "1 на 1 созвон с VisaGangBeatz",
      dropChance: 1,
      id: 1,
    },
    {
      text: "фидбек на твои биты / треки",
      dropChance: 25,
      id: 2,
    },
    {
      text: "Пусто :(",
      dropChance: 0,
      id: 7,
    },
    {
      text: "SPECIAL VISA PACK",
      dropChance: 22,
      id: 3,
    },
    {
      text: "помощь с твоим битом / треком",
      dropChance: 9,
      id: 4,
    },
    {
      text: "VISA & GUEST LOOP PACK",
      dropChance: 21,
      id: 5,
    },
    {
      text: "Пусто :(",
      dropChance: 0,
      id: 8,
    },
    {
      text: "секретный муз-подгон",
      dropChance: 22,
      id: 6,
    },
  ];

  const disablePrize = (id) => {
    prizes.find((el) => el.id == id).dropChance = 0;
  };

  switch (lastPrize) {
    case 1:
      disablePrize(1);
      disablePrize(4);
      disablePrize(5);
      break;
    case 2:
      disablePrize(1);
      disablePrize(2);
      break;
    case 3:
      disablePrize(1);
      disablePrize(3);
      break;
    case 4:
      disablePrize(1);
      disablePrize(2);
      disablePrize(4);
      disablePrize(5);
      break;
    case 5:
      disablePrize(1);
      disablePrize(4);
      disablePrize(5);
      break;
    case 6:
      disablePrize(1);
      disablePrize(6);
      break;
  }

  if (finalPrizeAvailable) {
    disablePrize(1);
    disablePrize(2);
    disablePrize(3);
    disablePrize(4);
    disablePrize(5);
    disablePrize(6);

    prizes.find((el) => el.id == 2).dropChance = 100;
  }

  // ---------- Базовая настройка DOM элементов ----------
  availableSpinsElem.textContent = availableSpins;
  dealSpinsElem.textContent = dealSpins;

  // Если нет вращений
  if (availableSpins <= 0) {
    availableSpinsElem.textContent = "0";
  }

  // ---------- Переменные колеса ----------
  // угловой размер сектора
  const prizeSlice = 360 / prizes.length;
  const sliceOffset = 180 / prizeSlice;

  // Переменная с индексом выпавшего приза
  let prizeIndex;
  // переменная для анимации
  let wheelTickerAnim;
  // угол вращения
  let rotation = 0;
  // текущий сектор
  let currentSlice = 0;
  // флаг состояния вращения
  let isSpinning = false;

  // ---------- Сервисные функции ----------
  // ---------- Инициализация пула звуков ----------
  const POOL_SIZE = 50; // количество одновременных тиков
  const tickPool = [];
  let poolIndex = 0;

  for (let i = 0; i < POOL_SIZE; i++) {
    const tick = new Audio("./click_wheel.mp3");
    tick.preload = "auto"; // подгрузка в память
    tickPool.push(tick);
  }

  // ---------- Функция воспроизведения тика ----------
  function doClickSound() {
    const tick = tickPool[poolIndex];
    tick.currentTime = 0; // начинаем с начала
    tick.play().catch((e) => console.warn("Не удалось воспроизвести звук:", e));

    poolIndex = (poolIndex + 1) % POOL_SIZE; // переключаемся на следующий элемент пула
  }

  function getElemRotationAngle(elem) {
    const wheelSpinnerStyles = window.getComputedStyle(elem);

    const values = wheelSpinnerStyles.transform
      .split("(")[1]
      .split(")")[0]
      .split(",");
    const a = values[0];
    const b = values[1];
    let rad = Math.atan2(b, a);

    if (rad < 0) rad += 2 * Math.PI;

    const angle = Math.round(rad * (180 / Math.PI));

    return angle;
  }

  // Шанс дропа
  function lerp(min, max, value) {
    return (1 - value) * min + value * max;
  }

  function dropPrize(items) {
    const total = items.reduce(
      (accumulator, item) => accumulator + item.dropChance,
      0,
    );
    const chance = lerp(0, total, Math.random());

    let current = 0;
    for (let i = 0; i < items.length; i++) {
      let item = items[i];

      if (current <= chance && chance < current + item.dropChance) {
        return i;
      }

      current += item.dropChance;
    }

    return current;
  }

  // ---------- функции ----------
  function showPrizePopup(index) {
    document.querySelector(".popup__title").textContent = prizes[index].text;
    popupElem.classList.remove("hide");
    popupElem.classList.add("fade-in");
  }

  function setSpinsCount() {
    availableSpins -= 1;
    dealSpins += 1;

    availableSpinsElem.textContent = availableSpins;
    dealSpinsElem.textContent = dealSpins;

    if (availableSpins <= 0) {
    }
  }

  // ---------- Функции анимации ----------
  // определяем количество оборотов, которое сделает наше колесо
  const spinertia = (min, max) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  function runwheelTickerAnimation() {
    // взял код анимации отсюда: https://css-tricks.com/get-value-of-css-rotation-through-javascript/
    const angle = getElemRotationAngle(wheelSpinnerElem);
    const slice = Math.floor(angle / prizeSlice);

    // если появился новый сектор
    if (currentSlice !== slice) {
      doClickSound();

      // после того, как язычок прошёл сектор - делаем его текущим
      currentSlice = slice;
    }

    // запускаем анимацию
    wheelTickerAnim = requestAnimationFrame(runwheelTickerAnimation);
  }

  // ---------- Функции обработчиков событий ----------
  function onSpinButtonClick() {
    if (isSpinning) {
      return;
    }

    if (availableSpins <= 0) {
      alert("Нет вращений");

      return;
    }

    isSpinning = true;

    const angle = getElemRotationAngle(wheelSpinnerElem);
    wheelSpinnerElem.classList.remove("anim");
    wheelSpinnerElem.style.setProperty("--rotate", angle);

    setTimeout(() => {
      document.body.classList.add("is-spinning");
      document.body.classList.add("hide-controls");

      // задаём начальное вращение колеса
      prizeIndex = dropPrize(prizes);

      rotation =
        Math.floor(prizeIndex * -prizeSlice + spinertia(10, 15) * 360) -
        sliceOffset -
        Math.random() * (prizeSlice - sliceOffset * 2);

      // через CSS говорим секторам, как им повернуться
      wheelSpinnerElem.style.setProperty("--rotate", rotation);

      // запускаем анимацию вращения
      runwheelTickerAnimation();

      // Засчитываем результат
      setSpinsCount();
    }, 0);
  }

  function onWheelAnimationEnd() {
    if (!isSpinning) {
      return;
    }

    // останавливаем отрисовку вращения
    cancelAnimationFrame(runwheelTickerAnimation);

    // получаем текущее значение поворота колеса
    rotation %= 360;

    // убираем класс, который отвечает за вращение
    document.body.classList.remove("is-spinning");

    // отправляем в CSS новое положение поворота колеса
    wheelSpinnerElem.style.setProperty("--rotate", rotation);
    // делаем кнопку снова активной
    isSpinning = false;

    // отправляем подарок в бота
    fetch(
      "https://chatter.salebot.pro/api/e6a3af53e2e63cd6a4894fe3b8f11ada/callback",
      {
        method: "POST",
        body: JSON.stringify({
          message: `prize_${finalPrizeAvailable ? "final" : prizes[prizeIndex].id}`,
          client_id: clientId,
        }),
      },
    );

    // Показываем попап
    setTimeout(() => {
      showPrizePopup(prizeIndex);
    }, 200);
  }

  function onClosePopup() {
    popupElem.classList.add("fade-out");
    popupElem.classList.remove("fade-in");

    setTimeout(() => {
      popupElem.classList.add("hide");
      popupElem.classList.remove("fade-out");

      document.querySelectorAll(".popup__prize").forEach((el) => {
        el.classList.add("hide");
      });
      document.body.classList.remove("hide-controls");
    }, 300);
  }

  // ---------- Обработчики событий ----------
  // Начало анимации
  wheelSpinButtonElem.addEventListener("click", onSpinButtonClick);

  // Конец вращения
  wheelSpinnerElem.addEventListener("transitionend", onWheelAnimationEnd);

  // Закрытие попапа
  popupCloseElem.addEventListener("click", onClosePopup);

  // Принудительно пересчитать размеры колеса и центрировать

  window.addEventListener("load", () => {
    document.querySelector(".wheel-img").onload = () => {
      document
        .querySelector(".wheel__spinner")
        .style.setProperty("--rotate", "0");
    };
  });

  // ---------- PRELOADER ----------
  const preloader = document.getElementById("preloader");

  window.addEventListener("load", () => {
    setTimeout(() => {
      preloader.classList.add("loaded");

      setTimeout(() => {
        preloader.remove();
      }, 400);
    }, 300); // небольшая пауза для плавности
  });

  setTimeout(() => {
    preloader.classList.add("loaded");

    setTimeout(() => {
      preloader.remove();
    }, 400);
  }, 5000); // небольшая пауза для плавности
})();
