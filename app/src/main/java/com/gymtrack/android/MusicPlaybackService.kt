package com.gymtrack.android

import android.content.Intent
import android.net.Uri
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import org.json.JSONArray
import org.json.JSONObject

/**
 * Music player for local user-selected audio files.
 * Media3 manages the foreground media notification and lock-screen buttons.
 * Spotify/YouTube protected streams are not downloaded or played here.
 */
class MusicPlaybackService : MediaSessionService() {
    private var player:ExoPlayer?=null
    private var session:MediaSession?=null

    override fun onCreate(){
        super.onCreate()
        val p=ExoPlayer.Builder(this).build().apply{
            setAudioAttributes(AudioAttributes.Builder()
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).setUsage(C.USAGE_MEDIA).build(),true)
            setWakeMode(C.WAKE_MODE_LOCAL)
            repeatMode=Player.REPEAT_MODE_ALL
        }
        p.addListener(object:Player.Listener{
            override fun onIsPlayingChanged(isPlaying:Boolean){writeState()}
            override fun onMediaItemTransition(item:MediaItem?,reason:Int){writeState()}
        })
        player=p
        session=MediaSession.Builder(this,p).build()
        writeState()
    }

    private fun writeState(){
        val p=player?:return
        val status=JSONObject().put("playing",p.isPlaying)
            .put("index",p.currentMediaItemIndex.coerceAtLeast(0))
        getSharedPreferences("gymtrack_music",MODE_PRIVATE).edit()
            .putString("state",status.toString()).apply()
    }

    private fun loadTracks():Boolean{
        val p=player?:return false
        val raw=getSharedPreferences("gymtrack_music",MODE_PRIVATE)
            .getString("tracks","[]") ?: "[]"
        val items=mutableListOf<MediaItem>()
        val arr=try{JSONArray(raw)}catch(_:Exception){JSONArray()}
        for(i in 0 until minOf(arr.length(),100)){
            val item=arr.optJSONObject(i)?:continue
            val uri=Uri.parse(item.optString("uri"))
            if(uri.scheme!="content")continue
            items.add(MediaItem.Builder().setUri(uri).setMediaMetadata(
                MediaMetadata.Builder().setTitle(item.optString("name","Аудиофайл")).build()
            ).build())
        }
        if(items.isEmpty())return false
        p.setMediaItems(items)
        p.prepare()
        return true
    }

    override fun onStartCommand(intent:Intent?,flags:Int,startId:Int):Int{
        val result=super.onStartCommand(intent,flags,startId)
        val p=player?:return result
        when(intent?.action){
            "track"->{
                if(loadTracks()){
                    val index=intent.getIntExtra("index",0).coerceIn(0,p.mediaItemCount-1)
                    p.seekTo(index,0)
                    p.play()
                }
            }
            "toggle"->{
                if(p.mediaItemCount==0&&!loadTracks())return result
                if(p.isPlaying)p.pause()else p.play()
            }
            "next"->{
                if(p.mediaItemCount==0&&!loadTracks())return result
                p.seekToNextMediaItem();p.play()
            }
            "previous"->{
                if(p.mediaItemCount==0&&!loadTracks())return result
                p.seekToPreviousMediaItem();p.play()
            }
        }
        writeState()
        return result
    }

    override fun onGetSession(controllerInfo:MediaSession.ControllerInfo):MediaSession?=session

    override fun onDestroy(){
        player?.pause()
        session?.release()
        player?.release()
        player=null
        session=null
        getSharedPreferences("gymtrack_music",MODE_PRIVATE).edit()
            .putString("state","{\"playing\":false,\"index\":0}").apply()
        super.onDestroy()
    }
}
