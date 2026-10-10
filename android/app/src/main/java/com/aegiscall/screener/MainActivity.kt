package com.aegiscall.screener

import android.os.Bundle
import com.aegiscall.screener.plugins.CallScreeningPlugin
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Register custom native CallScreening bridge plugin
        registerPlugin(CallScreeningPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
