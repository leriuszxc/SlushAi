const track = document.querySelector('.carousel-track');
const slides = document.querySelectorAll('.slide');
const prevBtn = document.querySelector('.prev-btn');
const nextBtn = document.querySelector('.next-btn');
const indicators = document.querySelectorAll('.indicator');
const descriptions = [
    'Возможность загружать аудиофайлы<br>для их расшифровки в текст.',
    'Исследование последовательности<br>и анализ данных.',
    'Дополнительные возможности<br>для работы с контентом.'
];

let currentIndex = 0;

function updateCarousel() {
    const offset = -currentIndex * 100;
    track.style.transform = `translateX(${offset}%)`;
    
    // Обновление индикаторов
    indicators.forEach((indicator, index) => {
        indicator.classList.toggle('active', index === currentIndex);
    });
    
    // Обновление описания
    document.querySelector('.description p').innerHTML = descriptions[currentIndex];
}

prevBtn.addEventListener('click', () => {
    currentIndex = (currentIndex - 1 + slides.length) % slides.length;
    updateCarousel();
});

nextBtn.addEventListener('click', () => {
    currentIndex = (currentIndex + 1) % slides.length;
    updateCarousel();
});

indicators.forEach((indicator, index) => {
    indicator.addEventListener('click', () => {
        currentIndex = index;
        updateCarousel();
    });
});
// Логика кнопки закрытия
const closeBtn = document.querySelector('.close-btn');

if (closeBtn) {
    closeBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
    });
}