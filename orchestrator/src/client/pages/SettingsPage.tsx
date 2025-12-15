/**
 * Settings page.
 */

import React, { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { AppSettings, ResumeProjectsSettings } from "../../shared/types"
import * as api from "../api"

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function resumeProjectsEqual(a: ResumeProjectsSettings, b: ResumeProjectsSettings) {
  return (
    a.maxProjects === b.maxProjects &&
    arraysEqual(a.lockedProjectIds, b.lockedProjectIds) &&
    arraysEqual(a.aiSelectableProjectIds, b.aiSelectableProjectIds)
  )
}

function clampInt(value: number, min: number, max: number) {
  const int = Math.floor(value)
  if (Number.isNaN(int)) return min
  return Math.min(max, Math.max(min, int))
}

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [modelDraft, setModelDraft] = useState("")
  const [pipelineWebhookUrlDraft, setPipelineWebhookUrlDraft] = useState("")
  const [jobCompleteWebhookUrlDraft, setJobCompleteWebhookUrlDraft] = useState("")
  const [resumeProjectsDraft, setResumeProjectsDraft] = useState<ResumeProjectsSettings | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    setIsLoading(true)
    api
      .getSettings()
      .then((data) => {
        if (!isMounted) return
        setSettings(data)
        setModelDraft(data.overrideModel ?? "")
        setPipelineWebhookUrlDraft(data.overridePipelineWebhookUrl ?? "")
        setJobCompleteWebhookUrlDraft(data.overrideJobCompleteWebhookUrl ?? "")
        setResumeProjectsDraft(data.resumeProjects)
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Failed to load settings"
        toast.error(message)
      })
      .finally(() => {
        if (!isMounted) return
        setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const effectiveModel = settings?.model ?? ""
  const defaultModel = settings?.defaultModel ?? ""
  const overrideModel = settings?.overrideModel
  const effectivePipelineWebhookUrl = settings?.pipelineWebhookUrl ?? ""
  const defaultPipelineWebhookUrl = settings?.defaultPipelineWebhookUrl ?? ""
  const overridePipelineWebhookUrl = settings?.overridePipelineWebhookUrl
  const effectiveJobCompleteWebhookUrl = settings?.jobCompleteWebhookUrl ?? ""
  const defaultJobCompleteWebhookUrl = settings?.defaultJobCompleteWebhookUrl ?? ""
  const overrideJobCompleteWebhookUrl = settings?.overrideJobCompleteWebhookUrl
  const profileProjects = settings?.profileProjects ?? []
  const maxProjectsTotal = profileProjects.length
  const lockedCount = resumeProjectsDraft?.lockedProjectIds.length ?? 0

  const canSave = useMemo(() => {
    if (!settings || !resumeProjectsDraft) return false
    const next = modelDraft.trim()
    const current = (overrideModel ?? "").trim()
    const nextWebhook = pipelineWebhookUrlDraft.trim()
    const currentWebhook = (overridePipelineWebhookUrl ?? "").trim()
    const nextJobCompleteWebhook = jobCompleteWebhookUrlDraft.trim()
    const currentJobCompleteWebhook = (overrideJobCompleteWebhookUrl ?? "").trim()
    return (
      next !== current ||
      nextWebhook !== currentWebhook ||
      nextJobCompleteWebhook !== currentJobCompleteWebhook ||
      !resumeProjectsEqual(resumeProjectsDraft, settings.resumeProjects)
    )
  }, [
    settings,
    modelDraft,
    pipelineWebhookUrlDraft,
    jobCompleteWebhookUrlDraft,
    overrideModel,
    overridePipelineWebhookUrl,
    overrideJobCompleteWebhookUrl,
    resumeProjectsDraft,
  ])

  const handleSave = async () => {
    if (!settings || !resumeProjectsDraft) return
    try {
      setIsSaving(true)
      const trimmed = modelDraft.trim()
      const webhookTrimmed = pipelineWebhookUrlDraft.trim()
      const jobCompleteTrimmed = jobCompleteWebhookUrlDraft.trim()
      const resumeProjectsOverride = resumeProjectsEqual(resumeProjectsDraft, settings.defaultResumeProjects)
        ? null
        : resumeProjectsDraft
      const updated = await api.updateSettings({
        model: trimmed.length > 0 ? trimmed : null,
        pipelineWebhookUrl: webhookTrimmed.length > 0 ? webhookTrimmed : null,
        jobCompleteWebhookUrl: jobCompleteTrimmed.length > 0 ? jobCompleteTrimmed : null,
        resumeProjects: resumeProjectsOverride,
      })
      setSettings(updated)
      setModelDraft(updated.overrideModel ?? "")
      setPipelineWebhookUrlDraft(updated.overridePipelineWebhookUrl ?? "")
      setJobCompleteWebhookUrlDraft(updated.overrideJobCompleteWebhookUrl ?? "")
      setResumeProjectsDraft(updated.resumeProjects)
      toast.success("Settings saved")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save settings"
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = async () => {
    try {
      setIsSaving(true)
      const updated = await api.updateSettings({
        model: null,
        pipelineWebhookUrl: null,
        jobCompleteWebhookUrl: null,
        resumeProjects: null,
      })
      setSettings(updated)
      setModelDraft("")
      setPipelineWebhookUrlDraft("")
      setJobCompleteWebhookUrlDraft("")
      setResumeProjectsDraft(updated.resumeProjects)
      toast.success("Reset to default")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reset settings"
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="container mx-auto max-w-3xl space-y-6 px-4 py-6 pb-12">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure runtime behavior for this app.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Model</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Override model</div>
            <Input
              value={modelDraft}
              onChange={(event) => setModelDraft(event.target.value)}
              placeholder={defaultModel || "openai/gpt-4o-mini"}
              disabled={isLoading || isSaving}
            />
            <div className="text-xs text-muted-foreground">
              Leave blank to use the default from server env (`MODEL`).
            </div>
          </div>

          <Separator />

          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <div className="text-xs text-muted-foreground">Effective</div>
              <div className="break-words font-mono text-xs">{effectiveModel || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Default (env)</div>
              <div className="break-words font-mono text-xs">{defaultModel || "—"}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline Webhook</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Pipeline status webhook URL</div>
            <Input
              value={pipelineWebhookUrlDraft}
              onChange={(event) => setPipelineWebhookUrlDraft(event.target.value)}
              placeholder={defaultPipelineWebhookUrl || "https://..."}
              disabled={isLoading || isSaving}
            />
            <div className="text-xs text-muted-foreground">
              When set, the server sends a POST on pipeline completion/failure. Leave blank to disable.
            </div>
          </div>

          <Separator />

          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <div className="text-xs text-muted-foreground">Effective</div>
              <div className="break-words font-mono text-xs">{effectivePipelineWebhookUrl || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Default (env)</div>
              <div className="break-words font-mono text-xs">{defaultPipelineWebhookUrl || "—"}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Job Complete Webhook</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Job completion webhook URL</div>
            <Input
              value={jobCompleteWebhookUrlDraft}
              onChange={(event) => setJobCompleteWebhookUrlDraft(event.target.value)}
              placeholder={defaultJobCompleteWebhookUrl || "https://..."}
              disabled={isLoading || isSaving}
            />
            <div className="text-xs text-muted-foreground">
              When set, the server sends a POST when you mark a job as applied (includes the job description).
            </div>
          </div>

          <Separator />

          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <div className="text-xs text-muted-foreground">Effective</div>
              <div className="break-words font-mono text-xs">{effectiveJobCompleteWebhookUrl || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Default (env)</div>
              <div className="break-words font-mono text-xs">{defaultJobCompleteWebhookUrl || "—"}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resume Projects</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Max projects included</div>
            <Input
              type="number"
              inputMode="numeric"
              min={lockedCount}
              max={maxProjectsTotal}
              value={resumeProjectsDraft?.maxProjects ?? 0}
              onChange={(event) => {
                if (!resumeProjectsDraft) return
                const next = Number(event.target.value)
                const clamped = clampInt(next, lockedCount, maxProjectsTotal)
                setResumeProjectsDraft({ ...resumeProjectsDraft, maxProjects: clamped })
              }}
              disabled={isLoading || isSaving || !resumeProjectsDraft}
            />
            <div className="text-xs text-muted-foreground">
              Locked projects always count towards this cap. Locked: {lockedCount} · AI pool:{" "}
              {resumeProjectsDraft?.aiSelectableProjectIds.length ?? 0} · Total projects: {maxProjectsTotal}
            </div>
          </div>

          <Separator />

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead className="w-[110px]">Base visible</TableHead>
                <TableHead className="w-[90px]">Locked</TableHead>
                <TableHead className="w-[140px]">AI selectable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profileProjects.map((project) => {
                const locked = Boolean(resumeProjectsDraft?.lockedProjectIds.includes(project.id))
                const aiSelectable = Boolean(resumeProjectsDraft?.aiSelectableProjectIds.includes(project.id))
                const excluded = !locked && !aiSelectable

                return (
                  <TableRow key={project.id}>
                    <TableCell>
                      <div className="space-y-0.5">
                        <div className="font-medium">{project.name || project.id}</div>
                        <div className="text-xs text-muted-foreground">
                          {[project.description, project.date].filter(Boolean).join(" · ")}
                          {excluded ? " · Excluded" : ""}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{project.isVisibleInBase ? "Yes" : "No"}</TableCell>
                    <TableCell>
                      <Checkbox
                        checked={locked}
                        disabled={isLoading || isSaving || !resumeProjectsDraft}
                        onCheckedChange={(checked) => {
                          if (!resumeProjectsDraft) return
                          const isChecked = checked === true
                          const lockedIds = resumeProjectsDraft.lockedProjectIds.slice()
                          const selectableIds = resumeProjectsDraft.aiSelectableProjectIds.slice()

                          if (isChecked) {
                            if (!lockedIds.includes(project.id)) lockedIds.push(project.id)
                            const nextSelectable = selectableIds.filter((id) => id !== project.id)
                            const minCap = lockedIds.length
                            setResumeProjectsDraft({
                              ...resumeProjectsDraft,
                              lockedProjectIds: lockedIds,
                              aiSelectableProjectIds: nextSelectable,
                              maxProjects: Math.max(resumeProjectsDraft.maxProjects, minCap),
                            })
                            return
                          }

                          const nextLocked = lockedIds.filter((id) => id !== project.id)
                          if (!selectableIds.includes(project.id)) selectableIds.push(project.id)
                          setResumeProjectsDraft({
                            ...resumeProjectsDraft,
                            lockedProjectIds: nextLocked,
                            aiSelectableProjectIds: selectableIds,
                            maxProjects: clampInt(resumeProjectsDraft.maxProjects, nextLocked.length, maxProjectsTotal),
                          })
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={locked ? true : aiSelectable}
                        disabled={locked || isLoading || isSaving || !resumeProjectsDraft}
                        onCheckedChange={(checked) => {
                          if (!resumeProjectsDraft) return
                          const isChecked = checked === true
                          const selectableIds = resumeProjectsDraft.aiSelectableProjectIds.slice()
                          const nextSelectable = isChecked
                            ? selectableIds.includes(project.id)
                              ? selectableIds
                              : [...selectableIds, project.id]
                            : selectableIds.filter((id) => id !== project.id)
                          setResumeProjectsDraft({ ...resumeProjectsDraft, aiSelectableProjectIds: nextSelectable })
                        }}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleSave} disabled={isLoading || isSaving || !canSave}>
          {isSaving ? "Saving..." : "Save"}
        </Button>
        <Button variant="outline" onClick={handleReset} disabled={isLoading || isSaving || !settings}>
          Reset to default
        </Button>
      </div>
    </main>
  )
}
