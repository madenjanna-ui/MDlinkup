/* Family 24: media drafts, accessible action sheets and call feedback. */
(() => {
    function dialog(title) {
        const previous = document.activeElement;
        const el = document.createElement('dialog');
        el.className = 'family-dialog';
        el.setAttribute('aria-label', title);
        el.innerHTML = `<header><h2>${App.esc(title)}</h2><button type="button" aria-label="Закрыть" class="dialog-close">×</button></header><div class="dialog-body"></div>`;
        document.body.appendChild(el);
        el.querySelector('.dialog-close').onclick = () => el.close();
        el.addEventListener('click', event => { if (event.target === el && !el.uploadBusy) { const r=el.getBoundingClientRect(); if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)el.close(); } });
        el.addEventListener('close', () => { el.remove(); if(previous?.isConnected)previous.focus(); }, {once:true});
        return el;
    }
    const chatKey = (scope,id) => scope==='global'?'global':scope==='private'?App.getPrivateChatId(Auth.currentUser.id,id):String(id);

    App.pickAndSendMedia = function(scope,id,kind) {
        const input=document.createElement('input');
        input.type='file'; input.accept=kind==='photo'?'image/*':'video/*'; input.hidden=true;
        document.body.appendChild(input);
        input.oncancel=()=>input.remove();
        input.onchange=()=>{const file=input.files?.[0];input.remove();if(file)this.previewMedia(file,scope,id,kind);};
        input.click();
    };
    App.previewMedia = async function(file,scope,id,kind) {
        const owner=Number(Auth.currentUser.id), key=chatKey(scope,id), reply=this.replyTarget;
        const el=dialog(kind==='photo'?'Отправить фото':'Отправить видео');
        const body=el.querySelector('.dialog-body');
        body.innerHTML=`<div class="draft-preview"></div><p class="draft-file"></p><label>Подпись <span class="optional">· необязательно</span><textarea maxlength="2000" rows="2" placeholder="Добавьте пару слов…"></textarea></label><progress hidden max="100" aria-label="Отправка файла"></progress><p class="draft-status" role="status" aria-live="polite">Подготавливаем файл…</p><div class="dialog-actions"><button class="secondary draft-cancel">Отмена</button><button class="primary draft-send" disabled>Отправить</button></div>`;
        const send=body.querySelector('.draft-send'), cancel=body.querySelector('.draft-cancel'), status=body.querySelector('.draft-status'), caption=body.querySelector('textarea'), progress=body.querySelector('progress');
        body.querySelector('.draft-file').textContent=file.name;
        cancel.onclick=()=>el.close();
        let busy=false, objectUrl, media;
        el.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
        el.addEventListener('close',()=>{if(objectUrl)URL.revokeObjectURL(objectUrl);});
        el.showModal();
        try {
            if(!file.size)throw new Error('Файл пустой. Выберите другой.');
            if(kind==='video'&&file.size>6*1024*1024)throw new Error('Видео больше 6 МБ. Выберите короткий ролик.');
            const blob=kind==='photo'?await this.compressPhoto(file):file;
            if(kind==='photo'&&blob.size>3*1024*1024)throw new Error('Фото не удалось сжать до 3 МБ. Выберите другое.');
            if(!el.open)return;
            objectUrl=URL.createObjectURL(blob);
            const preview=document.createElement(kind==='photo'?'img':'video');
            preview.src=objectUrl;preview.alt='Предпросмотр фото';
            if(kind==='video'){preview.controls=true;preview.playsInline=true;preview.preload='metadata';}
            body.querySelector('.draft-preview').appendChild(preview);
            media={id:crypto.randomUUID(),mime:blob.type,data:await this.blobToDataURL(blob),name:file.name,size:blob.size};
            if(!el.open)return;
            status.textContent=`${(blob.size/1024/1024).toFixed(1)} МБ · файл ещё не отправлен`;
            send.disabled=false;
        } catch(error) {status.textContent=error.message;return;}
        send.onclick=async()=>{
            if(busy)return;
            if(Number(Auth.currentUser?.id)!==owner){el.close();return;}
            busy=true;el.uploadBusy=true;send.disabled=true;cancel.disabled=true;caption.disabled=true;el.querySelector('.dialog-close').disabled=true;
            progress.hidden=false;progress.value=0;status.textContent='Отправляем…';
            try {
                const sent=await this.uploadMedia(scope,id,{...media,caption:caption.value.trim()},reply,percent=>{
                    progress.value=percent;status.textContent=percent===100?'Файл загружен. Ждём подтверждение…':`Отправляем · ${percent}%`;
                });
                busy=false;el.uploadBusy=false;
                if(Number(Auth.currentUser?.id)===owner){
                    if(this.replyTarget===reply)this.replyTarget=null;
                    if(this.isCurrentChat(scope,key))this.appendSentMessage(sent,scope==='global',id,scope);
                    this.cosmicSound('send');this.toast('Отправлено',kind==='photo'?'Фото добавлено в чат':'Видео добавлено в чат');
                }
                el.close();
            } catch(error) {
                busy=false;el.uploadBusy=false;send.disabled=false;cancel.disabled=false;caption.disabled=false;el.querySelector('.dialog-close').disabled=false;
                progress.hidden=true;
                status.textContent=error.message;
                send.textContent='Повторить отправку';
                // A lost response can follow a successful save: never retry silently.
                if(error.uncertain){send.disabled=true;status.textContent='Сервер не подтвердил отправку. Закройте окно и проверьте чат перед повторной отправкой.';}
            }
        };
    };
    App.uploadMedia=function(scope,id,media,replyTo,onProgress){
        return new Promise((resolve,reject)=>{
            const path=scope==='global'?'/api/messages/global':scope==='group'?`/api/groups/${Number(id)}`:`/api/messages/private/${Number(id)}`;
            const xhr=new XMLHttpRequest();xhr.open('POST',FAMILY_API_BASE+path);xhr.timeout=120000;
            xhr.setRequestHeader('Content-Type','application/json');xhr.setRequestHeader('Authorization',`Bearer ${API.token}`);
            xhr.upload.onprogress=event=>{if(event.lengthComputable)onProgress(Math.round(event.loaded/event.total*100));};
            const uncertain=()=>reject(Object.assign(new Error('Не получено подтверждение сервера'),{uncertain:true}));
            xhr.onerror=uncertain;xhr.ontimeout=uncertain;
            xhr.onload=()=>{
                let data;try{data=JSON.parse(xhr.responseText);}catch{uncertain();return;}
                if(xhr.status>=200&&xhr.status<300&&data.message)resolve(data.message);
                else reject(Object.assign(new Error(data.error||`Ошибка сервера ${xhr.status}`),{uncertain:xhr.status>=500}));
            };
            xhr.send(JSON.stringify({media,replyTo}));
        });
    };

    const renderMessage=App.messageHtml;
    App.messageHtml=function(m,global,id){
        let html=renderMessage.call(this,m,global,id);
        html=html.replace('class="message-menu-btn"','class="message-menu-btn" aria-label="Действия с сообщением" title="Действия с сообщением"');
        if(m.media?.caption)html=html.replace('<div class="message-meta">',`<div class="message-caption">${this.esc(m.media.caption)}</div><div class="message-meta">`);
        return html;
    };
    App.messageMenu=function(event,scope,key,id){
        event.preventDefault();event.stopPropagation();
        if(document.querySelector('.family-message-actions'))return false;
        const message=this.findCurrentMessage(scope,key,id);if(!message)return false;
        const mine=Number(message.authorId)===Number(Auth.currentUser.id);
        const label={audio:'Голосовое сообщение',video:'Видео',photo:'Фото'}[message.type]||'Сообщение';
        const el=dialog(label);el.classList.add('family-message-actions');
        const body=el.querySelector('.dialog-body');
        const preview=document.createElement('p');preview.className='action-summary';preview.textContent=(message.text||message.media?.caption||label).slice(0,140);body.appendChild(preview);
        const add=(text,action,danger=false)=>{const button=document.createElement('button');button.className=danger?'action-row danger':'action-row';button.textContent=text;button.onclick=()=>{el.close();action();};body.appendChild(button);};
        add('↩ Ответить',()=>{
            this.replyTarget={id:message.id,author:message.author,text:message.text||message.media?.caption||label,type:message.type};
            if(scope==='group')this.openGroupChat(Number(key));else this.refreshOpenChat(scope==='global',Number(document.body.dataset.privateUser||0));
        });
        if(message.text||message.media?.caption)add('Копировать текст',async()=>{try{await navigator.clipboard.writeText(message.text||message.media.caption);this.toast('Скопировано','Текст в буфере обмена');}catch{this.toast('Не удалось скопировать','Выделите текст сообщения вручную');}});
        if(mine&&message.type==='text')add('Изменить текст',()=>this.editMessage(scope,key,id));
        add(this.isFavorite(scope,key,id)?'Убрать из избранного':'В избранное',()=>this.toggleFavorite(scope,key,id));
        if(mine||Auth.isAdmin())add('Удалить у всех участников',()=>this.deleteMessage(scope,key,id),true);
        el.showModal();return false;
    };
    App.deleteMessage=function(scope,key,id){
        const el=dialog('Удалить сообщение?');
        const body=el.querySelector('.dialog-body');
        body.innerHTML='<p>Сообщение исчезнет из чата у всех участников. Сохранённые ими копии файлов останутся.</p><p role="status"></p><div class="dialog-actions"><button class="secondary cancel">Оставить</button><button class="primary delete">Удалить</button></div>';
        body.querySelector('.cancel').onclick=()=>el.close();
        body.querySelector('.delete').onclick=async()=>{
            const button=body.querySelector('.delete');button.disabled=true;
            try{await API.deleteMessage(scope,key,id);this._chatMessageCache?.clear();el.close();
                if(this.isCurrentChat(scope,key)){
                    this._lastMessages=(this._lastMessages||[]).filter(m=>Number(m.id)!==Number(id));
                    const root=document.getElementById(scope==='group'?'groupMessages':scope==='global'?'messages':'privateMessages');
                    const row=root?.querySelector(`[data-message-id="${Number(id)}"]`);
                    row?.querySelectorAll('audio,video').forEach(media=>media.pause());row?.remove();
                }
            }catch(error){body.querySelector('[role=status]').textContent=error.message;button.disabled=false;}
        };el.showModal();
    };
    let press;
    const cancelPress=()=>{if(press)clearTimeout(press.timer);press=null;};
    document.addEventListener('pointerdown',event=>{
        if(event.pointerType==='mouse'||event.button>0)return;
        const row=event.target.closest('.message[data-message-id]');
        if(!row||event.target.closest('button,a,audio,video,input,textarea'))return;
        cancelPress();const scope=App.activeChatScope,key=App.activeChatKey;
        press={x:event.clientX,y:event.clientY,timer:setTimeout(()=>{press=null;if(App.isCurrentChat(scope,key)&&row.isConnected)App.messageMenu(event,scope,key,Number(row.dataset.messageId));},550)};
    });
    document.addEventListener('pointermove',event=>{if(press&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>10)cancelPress();},{passive:true});
    ['pointerup','pointercancel','scroll'].forEach(type=>document.addEventListener(type,cancelPress,{passive:true,capture:true}));

    App.setCallStatus=function(text,detail='',retry=false){
        const status=document.querySelector('.call-top span');if(status)status.textContent=text;
        const note=document.getElementById('callHint');if(note)note.textContent=detail;
        const button=document.getElementById('callRetry');if(button)button.hidden=!retry;
    };
    App.retryVisibleCall=async function(){
        const target=this.callTargetId,video=this.callVideo;
        if(!target)return;
        await this.endCall(true);await this.startCall(target,video,false);
    };
    const showCall=App.showCallOverlay;
    App.showCallOverlay=function(state,name,video){
        showCall.call(this,state,name,video);
        const top=document.querySelector('.call-top');
        const hint=document.createElement('p');hint.id='callHint';hint.setAttribute('role','status');top.appendChild(hint);
        const retry=document.createElement('button');retry.id='callRetry';retry.textContent='Повторить звонок';retry.hidden=true;retry.onclick=()=>this.retryVisibleCall();top.appendChild(retry);
        const play=document.createElement('button');play.id='callPlay';play.hidden=true;play.textContent='Включить звук и видео';play.onclick=()=>this.attachRemoteStream();top.appendChild(play);
        this.setCallStatus(state==='incoming'?(video?'Входящий видеозвонок':'Входящий аудиозвонок'):state==='calling'?'Вызываем собеседника…':'Подключаем звук и видео…',state==='incoming'?'Нажмите «Принять», чтобы начать разговор.':'');
        this.attachRemoteStream();
    };
    App.attachRemoteStream=function(){
        const remote=document.getElementById('callRemote');if(!remote||!this.callRemoteStream)return;
        remote.srcObject=this.callRemoteStream;
        remote.play().then(()=>{const button=document.getElementById('callPlay');if(button)button.hidden=true;}).catch(()=>{const button=document.getElementById('callPlay');if(button)button.hidden=false;});
    };
    const createPeer=App.createPeerConnection;
    App.createPeerConnection=function(servers){
        const pc=createPeer.call(this,servers);
        const originalStateChange=pc.onconnectionstatechange;
        pc.onconnectionstatechange=()=>{
            if(pc!==this.callPc)return;
            // Keep the existing single ICE-restart attempt.
            if(pc.connectionState==='failed')originalStateChange?.();
            if(pc.connectionState==='connected'){
                this.callConnected=true;this.setCallStatus('На связи');
            }else if(pc.connectionState==='disconnected'){
                this.callConnected=false;this.setCallStatus('Связь прервалась','Ждём восстановления сети.');
            }else if(pc.connectionState==='failed'){
                this.callConnected=false;this.setCallStatus('Не удалось установить связь','Проверьте интернет у обоих участников и повторите звонок.',true);
            }else if(pc.connectionState==='connecting')this.setCallStatus('Соединяем…','Собеседник ответил. Подключаем звук и видео.');
        };return pc;
    };
    const answerCall=App.receiveCallAnswer;
    App.receiveCallAnswer=async function(msg){
        if(Number(msg.from)!==Number(this.callTargetId))return;
        await answerCall.call(this,msg);
        if(this.callPc?.connectionState!=='connected')this.setCallStatus('Собеседник ответил','Подключаем звук и видео…');
    };
})();
