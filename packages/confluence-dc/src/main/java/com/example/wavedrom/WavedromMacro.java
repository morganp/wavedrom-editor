package com.example.wavedrom;

import com.atlassian.confluence.content.render.xhtml.ConversionContext;
import com.atlassian.confluence.macro.Macro;
import com.atlassian.confluence.macro.MacroExecutionException;
import com.atlassian.confluence.renderer.radeox.macros.MacroUtils;
import com.atlassian.confluence.util.velocity.VelocityUtils;
import com.atlassian.plugin.webresource.WebResourceManager;

import java.util.Map;
import java.util.UUID;

public class WavedromMacro implements Macro {

    private final WebResourceManager webResourceManager;

    public WavedromMacro(WebResourceManager webResourceManager) {
        this.webResourceManager = webResourceManager;
    }

    @Override
    public String execute(Map<String, String> params, String body, ConversionContext ctx)
            throws MacroExecutionException {

        // Load the lightweight view bundle on every page that renders this macro.
        webResourceManager.requireResourcesForContext("wavedrom.view");

        String json      = (body != null && !body.isBlank()) ? body.trim() : "{}";
        String instanceId = "wd-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        boolean editable  = !ctx.isExport();

        Map<String, Object> context = MacroUtils.defaultVelocityContext();
        context.put("json",       escapeHtmlAttr(json));
        context.put("instanceId", instanceId);
        context.put("editable",   editable);

        return VelocityUtils.getRenderedTemplate("templates/macro-view.vm", context);
    }

    @Override public BodyType   getBodyType()   { return BodyType.PLAIN_TEXT; }
    @Override public OutputType getOutputType() { return OutputType.BLOCK; }

    private static String escapeHtmlAttr(String s) {
        return s.replace("&", "&amp;")
                .replace("\"", "&quot;")
                .replace("<", "&lt;")
                .replace(">", "&gt;");
    }
}
