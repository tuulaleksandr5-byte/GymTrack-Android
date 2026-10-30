package com.gymtrack.android

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Color
import android.net.Uri
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
