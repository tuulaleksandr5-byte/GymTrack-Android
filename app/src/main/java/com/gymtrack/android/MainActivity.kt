package com.gymtrack.android

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.provider.OpenableColumns
import org.json.JSONArray
import org.json.JSONObject
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.webkit.WebViewAssetLoader
import java.nio.charset.StandardCharsets

class MainActivity : Activity() {
    private lateinit var browser: WebView
    private var chooser: ValueCallback<Array<Uri>>? = null
    private var backup: String? = null
    companion object {
        private const val PICK_FILE = 1201
        private const val SAVE_FILE = 1202
        private const val PICK_AUDIO = 1203
        private const val APP_URL = "https://appassets.androidplatform.net/assets/index.html"
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor=Color.rgb(11,13,16)
        window.navigationBarColor=Color.rgb(11,13,16)
        val loader=WebViewAssetLoader.Builder()
            .addPathHandler("/assets/",WebViewAssetLoader.AssetsPathHandler(this)).build()
        browser=WebView(this)
        browser.setBackgroundColor(Color.rgb(11,13,16))
        setContentView(browser)
        browser.settings.apply {
            javaScriptEnabled=true
            domStorageEnabled=true
            allowFileAccess=false
            allowContentAccess=true
            mediaPlaybackRequiresUserGesture=true
        }
        browser.addJavascriptInterface(Bridge(),"GymTrackAndroid")
        browser.webViewClient=object:WebViewClient(){
            override fun shouldInterceptRequest(view:WebView?,request:WebResourceRequest?)=
                request?.let { loader.shouldInterceptRequest(it.url) }
            override fun shouldOverrideUrlLoading(view:WebView?,request:WebResourceRequest?):Boolean {
                val uri=request?.url?:return true
                if(uri.scheme=="https"&&uri.host=="appassets.androidplatform.net"&&
                   uri.path?.startsWith("/assets/")==true)return false
                openExternal(uri);return true
            }
        }
        browser.webChromeClient=object:WebChromeClient(){
            override fun onShowFileChooser(
                webView:WebView?,callback:ValueCallback<Array<Uri>>?,params:FileChooserParams?
            ):Boolean {
                if(callback==null||params==null)return false
                chooser?.onReceiveValue(null);chooser=callback
                return try {
                    startActivityForResult(params.createIntent(),PICK_FILE)
                    true
                }catch(_:ActivityNotFoundException){
                    chooser?.onReceiveValue(null);chooser=null
                    Toast.makeText(this@MainActivity,"Выбор файлов недоступен",Toast.LENGTH_SHORT).show()
                    false
                }
            }
        }
        browser.loadUrl(APP_URL)
    }
    private fun openExternal(uri:Uri){
        if(uri.scheme!="https"&&uri.scheme!="http")return
        try {startActivity(Intent(Intent.ACTION_VIEW,uri))}
        catch(_:ActivityNotFoundException){
            Toast.makeText(this,"Нет приложения для ссылки",Toast.LENGTH_SHORT).show()
        }
    }
    inner class Bridge{

        @JavascriptInterface fun getNativeTracks():String =
            getSharedPreferences("gymtrack_music",MODE_PRIVATE).getString("tracks","[]") ?: "[]"

        @JavascriptInterface fun getNativeState():String =
            getSharedPreferences("gymtrack_music",MODE_PRIVATE).getString("state","{\"playing\":false,\"index\":0}") ?: "{}"

        @JavascriptInterface fun pickNativeAudio(){
            runOnUiThread {
                val intent=Intent(Intent.ACTION_OPEN_DOCUMENT).apply{
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type="audio/*"
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
                }
                try {startActivityForResult(intent,PICK_AUDIO)}
                catch(_:ActivityNotFoundException){
                    Toast.makeText(this@MainActivity,"Выбор аудиофайлов недоступен",Toast.LENGTH_LONG).show()
                }
            }
        }

        @JavascriptInterface fun nativeMusicCommand(command:String,index:Int){
            if(command !in setOf("track","toggle","next","previous") || index !in 0..999)return
            runOnUiThread {
                val i=Intent(this@MainActivity,MusicPlaybackService::class.java)
                i.action=command
                i.putExtra("index",index)
                try {startService(i)}
                catch(_:Exception){
                    Toast.makeText(this@MainActivity,"Плеер недоступен",Toast.LENGTH_LONG).show()
                }
            }
        }
        @JavascriptInterface fun openExternal(url:String){
            if(url.length>2048)return
            runOnUiThread { this@MainActivity.openExternal(Uri.parse(url)) }
        }
        @JavascriptInterface fun saveJson(json:String,name:String){
            if(json.length>5_000_000)return
            val filename=name.take(80).replace(Regex("[^a-zA-Z0-9._-]"),"_")
                .ifBlank {"gymtrack-backup.json"}
            runOnUiThread {
                backup=json
                val intent=Intent(Intent.ACTION_CREATE_DOCUMENT).apply{
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type="application/json"
                    putExtra(Intent.EXTRA_TITLE,filename)
                }
                try {startActivityForResult(intent,SAVE_FILE)}
                catch(_:ActivityNotFoundException){
                    backup=null
                    Toast.makeText(this@MainActivity,"Сохранение недоступно",Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
    @Deprecated("Android document picker compatibility")
    override fun onActivityResult(requestCode:Int,resultCode:Int,data:Intent?){
        super.onActivityResult(requestCode,resultCode,data)
        when(requestCode){
            PICK_FILE->{
                chooser?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode,data))
                chooser=null
            }
            PICK_AUDIO->{
                if(resultCode==RESULT_OK&&data!=null){
                    val uris=mutableListOf<Uri>()
                    data.clipData?.let{clip->
                        for(n in 0 until clip.itemCount)uris.add(clip.getItemAt(n).uri)
                    }
                    data.data?.let{ if(!uris.contains(it))uris.add(it) }
                    val tracks=JSONArray()
                    uris.distinct().take(100).forEach{uri->
                        if(uri.scheme=="content"){
                            try {
                                contentResolver.takePersistableUriPermission(uri,Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                var name="Аудиофайл"
                                contentResolver.query(uri,arrayOf(OpenableColumns.DISPLAY_NAME),null,null,null)?.use{cursor->
                                    if(cursor.moveToFirst())name=cursor.getString(0) ?: name
                                }
                                tracks.put(JSONObject().put("uri",uri.toString()).put("name",name.take(160)))
                            }catch(_:Exception){}
                        }
                    }
                    if(tracks.length()>0){
                        stopService(Intent(this,MusicPlaybackService::class.java))
                        getSharedPreferences("gymtrack_music",MODE_PRIVATE).edit()
                            .putString("tracks",tracks.toString())
                            .putString("state","{\"playing\":false,\"index\":0}").apply()
                        browser.evaluateJavascript("window.gymtrackReceiveTracks(${tracks})",null)
                        Toast.makeText(this,"Добавлено файлов: ${tracks.length()}",Toast.LENGTH_SHORT).show()
                    }
                }
            }
            SAVE_FILE->{
                val text=backup;backup=null
                if(resultCode==RESULT_OK&&text!=null&&data?.data!=null){
                    try{
                        contentResolver.openOutputStream(data.data!!,"w")?.use {
                            it.write(text.toByteArray(StandardCharsets.UTF_8))
                        }?:error("Cannot open destination")
                        Toast.makeText(this,"JSON сохранён",Toast.LENGTH_SHORT).show()
                    }catch(_:Exception){
                        Toast.makeText(this,"Ошибка сохранения",Toast.LENGTH_LONG).show()
                    }
                }
            }
        }
    }
    @Deprecated("WebView back navigation")
    override fun onBackPressed(){
        if(::browser.isInitialized&&browser.canGoBack())browser.goBack()
        else super.onBackPressed()
    }
    override fun onPause(){super.onPause();if(::browser.isInitialized)browser.onPause()}
    override fun onResume(){super.onResume();if(::browser.isInitialized)browser.onResume()}
    override fun onDestroy(){
        chooser?.onReceiveValue(null);chooser=null
        if(::browser.isInitialized)browser.destroy()
        super.onDestroy()
    }
}
